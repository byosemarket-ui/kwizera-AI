//+------------------------------------------------------------------+
//| KwizeraReadonlySnapshot.mq5                                      |
//| Read-only HFM Demo: account + quotes + candles + symbol catalog  |
//| NEVER calls OrderSend / PositionClose / trade functions.         |
//| Catalog discovery does NOT mass-SymbolSelect the universe.       |
//+------------------------------------------------------------------+
#property copyright "KWIZERA AI STUDIO"
#property version   "1.40"
#property description "Read-only snapshot + on-demand CopyRates/CopyTicks. No trading."

#include <Trade/AccountInfo.mqh>

input int SnapshotIntervalSec = 3;     // Quote/account timer (seconds)
input int CandleBars = 64;             // Bars per timeframe (bounded for VPS)
input int CandleEveryN = 5;            // Write candles every N snapshots (+ durable file)
input int CatalogBatchSize = 20;       // Symbols per timer tick (catalog)
input int CatalogRefreshSec = 21600;   // Full rediscovery interval (6h)
input int MaxOnDemandBars = 300;       // Hard cap for history request CopyRates
input int MaxOnDemandTicks = 500;      // Hard cap for CopyTicksRange
input int MaxExtraQuoteSymbols = 8;    // Bounded extra SymbolSelect for charts

ulong g_seq = 0;
string g_extraQuotes[];                // STEP 2: bounded chart-context symbols
ulong  g_lastChartTickMsc = 0;

// Catalog discovery state (separate from quote snapshot).
bool   g_catalogRunning = false;
bool   g_catalogComplete = false;
int    g_catalogIndex = 0;
int    g_generalTotal = 0;
int    g_selectedTotal = 0;
int    g_enumerated = 0;
int    g_duplicateCount = 0;
int    g_customCount = 0;
int    g_validCount = 0;
datetime g_catalogStartedAt = 0;
datetime g_catalogCompletedAt = 0;
string g_catalogVersion = "";
string g_seenNames[];   // duplicate detection within current run (bounded)

string JsonEscape(const string s)
  {
   string out = s;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   StringReplace(out, "\n", "\\n");
   StringReplace(out, "\r", "\\r");
   return out;
  }

string NumOrNull(const double v)
  {
   if(!MathIsValidNumber(v))
      return "null";
   return DoubleToString(v, 8);
  }

string GmtIsoNow()
  {
   return TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + "Z";
  }

bool CatalogRefreshRequested()
  {
   // Agent may drop a request file to force rediscovery without login restart.
   int h = FileOpen("kwizera_catalog_refresh.request", FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen("kwizera_catalog_refresh.request", FILE_READ|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
      return false;
   FileClose(h);
   FileDelete("kwizera_catalog_refresh.request", FILE_COMMON);
   FileDelete("kwizera_catalog_refresh.request");
   return true;
  }

string ReadTextFile(const string name)
  {
   int h = FileOpen(name, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen(name, FILE_READ|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
      return "";
   string out = "";
   while(!FileIsEnding(h))
     {
      string line = FileReadString(h);
      if(StringLen(out) > 0)
         out += "\n";
      out += line;
      if(StringLen(out) > 4096)
         break;
     }
   FileClose(h);
   return out;
  }

bool WriteTextFile(const string name, const string body)
  {
   int h = FileOpen(name, FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen(name, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
      return false;
   FileWriteString(h, body);
   FileClose(h);
   return true;
  }

void DeleteRequest(const string name)
  {
   FileDelete(name, FILE_COMMON);
   FileDelete(name);
  }

ENUM_TIMEFRAMES ParseTimeframe(const string tf)
  {
   if(tf == "M1" || tf == "1m") return PERIOD_M1;
   if(tf == "M2" || tf == "2m") return PERIOD_M2;
   if(tf == "M3" || tf == "3m") return PERIOD_M3;
   if(tf == "M5" || tf == "5m") return PERIOD_M5;
   if(tf == "M10" || tf == "10m") return PERIOD_M10;
   if(tf == "M15" || tf == "15m") return PERIOD_M15;
   if(tf == "M20" || tf == "20m") return PERIOD_M20;
   if(tf == "M30" || tf == "30m") return PERIOD_M30;
   if(tf == "H1" || tf == "1h") return PERIOD_H1;
   if(tf == "H2" || tf == "2h") return PERIOD_H2;
   if(tf == "H3" || tf == "3h") return PERIOD_H3;
   if(tf == "H4" || tf == "4h") return PERIOD_H4;
   if(tf == "H6" || tf == "6h") return PERIOD_H6;
   if(tf == "H8" || tf == "8h") return PERIOD_H8;
   if(tf == "H12" || tf == "12h") return PERIOD_H12;
   if(tf == "D1" || tf == "1d") return PERIOD_D1;
   if(tf == "W1" || tf == "1w") return PERIOD_W1;
   if(tf == "MN1" || tf == "1M") return PERIOD_MN1;
   return PERIOD_CURRENT;
  }

string FieldAt(const string line, const int idx)
  {
   string parts[];
   int n = StringSplit(line, '|', parts);
   if(idx < 0 || idx >= n)
      return "";
   return parts[idx];
  }

void ProcessQuoteWatchRequest()
  {
   // Format: one symbol per line, max MaxExtraQuoteSymbols. Clears watch when empty file body.
   string raw = ReadTextFile("kwizera_quote_watch.request");
   if(StringLen(raw) <= 0)
      return;
   DeleteRequest("kwizera_quote_watch.request");
   string lines[];
   int n = StringSplit(raw, '\n', lines);
   ArrayResize(g_extraQuotes, 0);
   int kept = 0;
   for(int i = 0; i < n && kept < MaxExtraQuoteSymbols; i++)
     {
      string sym = lines[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      StringReplace(sym, "\r", "");
      if(StringLen(sym) < 2 || StringLen(sym) > 32)
         continue;
      if(!SymbolSelect(sym, true))
         continue;
      ArrayResize(g_extraQuotes, kept + 1);
      g_extraQuotes[kept] = sym;
      kept++;
     }
   WriteTextFile(
      "kwizera_quote_watch.status.json",
      "{\"provider\":\"HFM_MT5\",\"environment\":\"demo\",\"count\":" + IntegerToString(kept)
      + ",\"writtenAt\":\"" + GmtIsoNow() + "\",\"ordersEnabled\":false}"
   );
  }

void ProcessHistoryRequest()
  {
   // Line: requestId|symbol|timeframe|count|startPos
   // startPos = bar index from present (0 = latest). Expert never executes trades.
   string raw = ReadTextFile("kwizera_history.request");
   if(StringLen(raw) <= 0)
      return;
   DeleteRequest("kwizera_history.request");
   string line = raw;
   int nl = StringFind(line, "\n");
   if(nl >= 0)
      line = StringSubstr(line, 0, nl);
   StringReplace(line, "\r", "");

   string requestId = FieldAt(line, 0);
   string symbol = FieldAt(line, 1);
   string tfName = FieldAt(line, 2);
   int count = (int)StringToInteger(FieldAt(line, 3));
   int startPos = (int)StringToInteger(FieldAt(line, 4));
   if(StringLen(requestId) < 1)
      requestId = "unknown";
   if(count < 1) count = 1;
   if(count > MaxOnDemandBars) count = MaxOnDemandBars;
   if(startPos < 0) startPos = 0;
   if(startPos > 50000) startPos = 50000;

   ENUM_TIMEFRAMES tf = ParseTimeframe(tfName);
   string err = "";
   int copied = 0;
   string barsJson = "[";
   bool available = false;

   if(tf == PERIOD_CURRENT)
      err = "UNSUPPORTED_TIMEFRAME";
   else if(StringLen(symbol) < 2 || StringLen(symbol) > 32)
      err = "INVALID_SYMBOL";
   else if(!SymbolSelect(symbol, true))
      err = "SYMBOL_SELECT_FAILED";
   else
     {
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      copied = CopyRates(symbol, tf, startPos, count, rates);
      if(copied <= 0)
         err = "COPYRATES_EMPTY";
      else
        {
         available = true;
         bool firstBar = true;
         for(int i = copied - 1; i >= 0; i--)
           {
            if(!firstBar)
               barsJson += ",";
            firstBar = false;
            barsJson += "{";
            barsJson += "\"time\":" + IntegerToString((long)rates[i].time) + ",";
            barsJson += "\"open\":" + NumOrNull(rates[i].open) + ",";
            barsJson += "\"high\":" + NumOrNull(rates[i].high) + ",";
            barsJson += "\"low\":" + NumOrNull(rates[i].low) + ",";
            barsJson += "\"close\":" + NumOrNull(rates[i].close) + ",";
            barsJson += "\"tickVolume\":" + IntegerToString((long)rates[i].tick_volume) + ",";
            barsJson += "\"realVolume\":" + IntegerToString((long)rates[i].real_volume) + ",";
            barsJson += "\"spread\":" + IntegerToString((long)rates[i].spread);
            barsJson += "}";
           }
        }
     }
   barsJson += "]";

   bool hasMore = available && (copied >= count);
   string json = "{";
   json += "\"source\":\"mql5_ondemand_copyrates\",";
   json += "\"provider\":\"HFM_MT5\",";
   json += "\"environment\":\"demo\",";
   json += "\"schemaVersion\":1,";
   json += "\"expertVersion\":\"1.40\",";
   json += "\"requestId\":\"" + JsonEscape(requestId) + "\",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"timeframe\":\"" + JsonEscape(tfName) + "\",";
   json += "\"requestedCount\":" + IntegerToString(count) + ",";
   json += "\"startPos\":" + IntegerToString(startPos) + ",";
   json += "\"count\":" + IntegerToString(copied > 0 ? copied : 0) + ",";
   json += "\"available\":" + (available ? "true" : "false") + ",";
   json += "\"hasMore\":" + (hasMore ? "true" : "false") + ",";
   json += "\"error\":" + (StringLen(err) > 0 ? ("\"" + JsonEscape(err) + "\"") : "null") + ",";
   json += "\"brokerTime\":" + IntegerToString((long)TimeCurrent()) + ",";
   json += "\"gmtTime\":" + IntegerToString((long)TimeGMT()) + ",";
   json += "\"retrievedAt\":\"" + GmtIsoNow() + "\",";
   json += "\"candles\":" + barsJson + ",";
   json += "\"placesOrders\":false,\"mutatesBroker\":false,\"acceptsForExecution\":false";
   json += "}";
   WriteTextFile("kwizera_history.response.json", json);
  }

void ProcessTicksRequest()
  {
   // Line: requestId|symbol|count|fromMs|toMs
   // fromMs/toMs = 0 means "latest count ticks via CopyTicks"
   string raw = ReadTextFile("kwizera_ticks.request");
   if(StringLen(raw) <= 0)
      return;
   DeleteRequest("kwizera_ticks.request");
   string line = raw;
   int nl = StringFind(line, "\n");
   if(nl >= 0)
      line = StringSubstr(line, 0, nl);
   StringReplace(line, "\r", "");

   string requestId = FieldAt(line, 0);
   string symbol = FieldAt(line, 1);
   int count = (int)StringToInteger(FieldAt(line, 2));
   long fromMs = StringToInteger(FieldAt(line, 3));
   long toMs = StringToInteger(FieldAt(line, 4));
   if(StringLen(requestId) < 1)
      requestId = "unknown";
   if(count < 1) count = 1;
   if(count > MaxOnDemandTicks) count = MaxOnDemandTicks;

   string err = "";
   int copied = 0;
   string ticksJson = "[";
   bool available = false;

   if(StringLen(symbol) < 2 || StringLen(symbol) > 32)
      err = "INVALID_SYMBOL";
   else if(!SymbolSelect(symbol, true))
      err = "SYMBOL_SELECT_FAILED";
   else
     {
      MqlTick ticks[];
      ArraySetAsSeries(ticks, true);
      if(fromMs > 0 && toMs > fromMs)
         copied = CopyTicksRange(symbol, ticks, COPY_TICKS_ALL, fromMs, toMs);
      else
         copied = CopyTicks(symbol, ticks, COPY_TICKS_ALL, 0, count);
      if(copied <= 0)
         err = "COPYTICKS_EMPTY";
      else
        {
         available = true;
         if(copied > count)
            copied = count;
         bool first = true;
         for(int i = copied - 1; i >= 0; i--)
           {
            if(!first)
               ticksJson += ",";
            first = false;
            ticksJson += "{";
            ticksJson += "\"time\":" + IntegerToString((long)ticks[i].time) + ",";
            ticksJson += "\"timeMsc\":" + IntegerToString((long)ticks[i].time_msc) + ",";
            ticksJson += "\"bid\":" + NumOrNull(ticks[i].bid) + ",";
            ticksJson += "\"ask\":" + NumOrNull(ticks[i].ask) + ",";
            ticksJson += "\"last\":" + NumOrNull(ticks[i].last) + ",";
            ticksJson += "\"volume\":" + IntegerToString((long)ticks[i].volume) + ",";
            ticksJson += "\"volumeReal\":" + NumOrNull(ticks[i].volume_real) + ",";
            ticksJson += "\"flags\":" + IntegerToString((long)ticks[i].flags);
            ticksJson += "}";
           }
        }
     }
   ticksJson += "]";

   string json = "{";
   json += "\"source\":\"mql5_ondemand_copyticks\",";
   json += "\"provider\":\"HFM_MT5\",";
   json += "\"environment\":\"demo\",";
   json += "\"schemaVersion\":1,";
   json += "\"expertVersion\":\"1.40\",";
   json += "\"requestId\":\"" + JsonEscape(requestId) + "\",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"requestedCount\":" + IntegerToString(count) + ",";
   json += "\"count\":" + IntegerToString(copied > 0 ? copied : 0) + ",";
   json += "\"available\":" + (available ? "true" : "false") + ",";
   json += "\"error\":" + (StringLen(err) > 0 ? ("\"" + JsonEscape(err) + "\"") : "null") + ",";
   json += "\"acquisition\":\"CopyTicks\",";
   json += "\"brokerTime\":" + IntegerToString((long)TimeCurrent()) + ",";
   json += "\"gmtTime\":" + IntegerToString((long)TimeGMT()) + ",";
   json += "\"retrievedAt\":\"" + GmtIsoNow() + "\",";
   json += "\"ticks\":" + ticksJson + ",";
   json += "\"placesOrders\":false,\"mutatesBroker\":false,\"acceptsForExecution\":false";
   json += "}";
   WriteTextFile("kwizera_ticks.response.json", json);
  }

void WriteChartTick()
  {
   // Lightweight OnTick path for the chart symbol the Expert is attached to.
   string symbol = _Symbol;
   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
      return;
   if((ulong)tick.time_msc != 0 && (ulong)tick.time_msc == g_lastChartTickMsc)
      return;
   g_lastChartTickMsc = (ulong)tick.time_msc;
   string json = "{";
   json += "\"source\":\"mql5_ontick\",";
   json += "\"provider\":\"HFM_MT5\",";
   json += "\"environment\":\"demo\",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"bid\":" + ((tick.bid > 0) ? NumOrNull(tick.bid) : "null") + ",";
   json += "\"ask\":" + ((tick.ask > 0) ? NumOrNull(tick.ask) : "null") + ",";
   json += "\"last\":" + NumOrNull(tick.last) + ",";
   json += "\"time\":" + IntegerToString((long)tick.time) + ",";
   json += "\"timeMsc\":" + IntegerToString((long)tick.time_msc) + ",";
   json += "\"volume\":" + IntegerToString((long)tick.volume) + ",";
   json += "\"flags\":" + IntegerToString((long)tick.flags) + ",";
   json += "\"acquisitionMethod\":\"OnTick\",";
   json += "\"writtenAt\":\"" + GmtIsoNow() + "\",";
   json += "\"placesOrders\":false";
   json += "}";
   WriteTextFile("kwizera_chart_tick.json", json);
  }

void ProcessAcquisitionRequests()
  {
   ProcessQuoteWatchRequest();
   ProcessHistoryRequest();
   ProcessTicksRequest();
  }

void WriteCatalogMeta(const string status)
  {
   string server = AccountInfoString(ACCOUNT_SERVER);
   string json = "{";
   json += "\"source\":\"mql5_catalog\",";
   json += "\"schemaVersion\":1,";
   json += "\"provider\":\"HFM_MT5\",";
   json += "\"environment\":\"demo\",";
   json += "\"brokerServer\":\"" + JsonEscape(server) + "\",";
   json += "\"catalogVersion\":\"" + JsonEscape(g_catalogVersion) + "\",";
   json += "\"discoveryStatus\":\"" + status + "\",";
   json += "\"enumerationStartedAt\":\"" + (g_catalogStartedAt > 0 ? TimeToString(g_catalogStartedAt, TIME_DATE|TIME_SECONDS) + "Z" : "") + "\",";
   json += "\"enumerationCompletedAt\":\"" + (g_catalogCompletedAt > 0 ? TimeToString(g_catalogCompletedAt, TIME_DATE|TIME_SECONDS) + "Z" : "") + "\",";
   json += "\"writtenAt\":\"" + GmtIsoNow() + "\",";
   json += "\"generalSymbolCount\":" + IntegerToString(g_generalTotal) + ",";
   json += "\"selectedSymbolCount\":" + IntegerToString(g_selectedTotal) + ",";
   json += "\"enumeratedCount\":" + IntegerToString(g_enumerated) + ",";
   json += "\"validCount\":" + IntegerToString(g_validCount) + ",";
   json += "\"duplicateCount\":" + IntegerToString(g_duplicateCount) + ",";
   json += "\"customCount\":" + IntegerToString(g_customCount) + ",";
   json += "\"batchIndex\":" + IntegerToString(g_catalogIndex) + ",";
   json += "\"artifactReady\":" + ((status == "COMPLETE") ? "true" : "false") + ",";
   json += "\"note\":\"Catalog artifact separate from quote snapshot. No OrderSend. No mass SymbolSelect.\"";
   json += "}";

   int h = FileOpen("kwizera_catalog_meta.json", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen("kwizera_catalog_meta.json", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("KwizeraCatalog: meta FileOpen failed ", GetLastError());
      return;
     }
   FileWriteString(h, json);
   FileClose(h);
  }

bool SeenName(const string name)
  {
   int n = ArraySize(g_seenNames);
   for(int i = 0; i < n; i++)
     {
      if(g_seenNames[i] == name)
         return true;
     }
   return false;
  }

void RememberName(const string name)
  {
   int n = ArraySize(g_seenNames);
   ArrayResize(g_seenNames, n + 1);
   g_seenNames[n] = name;
  }

void AppendFieldError(string &errors, bool &firstErr, const string field, const string reason)
  {
   if(!firstErr)
      errors += ",";
   firstErr = false;
   errors += "\"" + field + "\":\"" + reason + "\"";
  }

string JsonIntProp(const string symbol, const ENUM_SYMBOL_INFO_INTEGER prop, const string field, string &errors, bool &firstErr)
  {
   long v = 0;
   if(!SymbolInfoInteger(symbol, prop, v))
     {
      AppendFieldError(errors, firstErr, field, "UNAVAILABLE");
      return "null";
     }
   return IntegerToString(v);
  }

string JsonBoolProp(const string symbol, const ENUM_SYMBOL_INFO_INTEGER prop, const string field, string &errors, bool &firstErr)
  {
   long v = 0;
   if(!SymbolInfoInteger(symbol, prop, v))
     {
      AppendFieldError(errors, firstErr, field, "UNAVAILABLE");
      return "null";
     }
   return (v != 0) ? "true" : "false";
  }

string JsonDoubleProp(const string symbol, const ENUM_SYMBOL_INFO_DOUBLE prop, const string field, string &errors, bool &firstErr)
  {
   double v = 0.0;
   if(!SymbolInfoDouble(symbol, prop, v))
     {
      AppendFieldError(errors, firstErr, field, "UNAVAILABLE");
      return "null";
     }
   if(!MathIsValidNumber(v))
     {
      AppendFieldError(errors, firstErr, field, "INVALID");
      return "null";
     }
   return DoubleToString(v, 8);
  }

string JsonStringProp(const string symbol, const ENUM_SYMBOL_INFO_STRING prop, const string field, string &errors, bool &firstErr)
  {
   string v = "";
   if(!SymbolInfoString(symbol, prop, v))
     {
      AppendFieldError(errors, firstErr, field, "UNAVAILABLE");
      return "null";
     }
   if(StringLen(v) == 0)
     {
      AppendFieldError(errors, firstErr, field, "EMPTY");
      return "null";
     }
   return "\"" + JsonEscape(v) + "\"";
  }

string BuildSessionSummary(const string symbol, string &errors, bool &firstErr)
  {
   // Day 0..6, session indices 0..7 (trade + quote). No SymbolSelect.
   // Emits primary tradeFrom/To (index 0 / first valid) plus tradeWindows/quoteWindows arrays.
   string out = "{";
   bool firstDay = true;
   int tradeSessionDays = 0;
   int quoteSessionDays = 0;
   for(int day = 0; day <= 6; day++)
     {
      string tradeWindows = "[";
      string quoteWindows = "[";
      bool firstTradeW = true;
      bool firstQuoteW = true;
      long primaryTradeFrom = -1;
      long primaryTradeTo = -1;
      long primaryQuoteFrom = -1;
      long primaryQuoteTo = -1;
      int tradeCount = 0;
      int quoteCount = 0;
      for(int idx = 0; idx < 8; idx++)
        {
         datetime fromT = 0;
         datetime toT = 0;
         if(SymbolInfoSessionTrade(symbol, (ENUM_DAY_OF_WEEK)day, idx, fromT, toT))
           {
            long f = (long)fromT;
            long t = (long)toT;
            // Zero-length windows are explicit closed slots — skip in window arrays.
            if(t > f)
              {
               if(!firstTradeW)
                  tradeWindows += ",";
               firstTradeW = false;
               tradeWindows += "{\"fromSec\":" + IntegerToString(f) + ",\"toSec\":" + IntegerToString(t) + "}";
               if(primaryTradeFrom < 0)
                 {
                  primaryTradeFrom = f;
                  primaryTradeTo = t;
                 }
               tradeCount++;
              }
           }
         datetime qFrom = 0;
         datetime qTo = 0;
         if(SymbolInfoSessionQuote(symbol, (ENUM_DAY_OF_WEEK)day, idx, qFrom, qTo))
           {
            long f = (long)qFrom;
            long t = (long)qTo;
            if(t > f)
              {
               if(!firstQuoteW)
                  quoteWindows += ",";
               firstQuoteW = false;
               quoteWindows += "{\"fromSec\":" + IntegerToString(f) + ",\"toSec\":" + IntegerToString(t) + "}";
               if(primaryQuoteFrom < 0)
                 {
                  primaryQuoteFrom = f;
                  primaryQuoteTo = t;
                 }
               quoteCount++;
              }
           }
        }
      tradeWindows += "]";
      quoteWindows += "]";
      // Always emit days 0..6 so closed weekdays are explicit (empty windows).
      if(!firstDay)
         out += ",";
      firstDay = false;
      out += "\"" + IntegerToString(day) + "\":{";
      if(primaryTradeFrom >= 0)
        {
         out += "\"tradeFrom\":" + IntegerToString(primaryTradeFrom) + ",";
         out += "\"tradeTo\":" + IntegerToString(primaryTradeTo);
        }
      else
        {
         out += "\"tradeFrom\":0,\"tradeTo\":0";
        }
      out += ",";
      if(primaryQuoteFrom >= 0)
        {
         out += "\"quoteFrom\":" + IntegerToString(primaryQuoteFrom) + ",";
         out += "\"quoteTo\":" + IntegerToString(primaryQuoteTo);
        }
      else
        {
         out += "\"quoteFrom\":0,\"quoteTo\":0";
        }
      out += ",\"tradeWindows\":" + tradeWindows;
      out += ",\"quoteWindows\":" + quoteWindows;
      out += "}";
      if(tradeCount > 0)
         tradeSessionDays++;
      if(quoteCount > 0)
         quoteSessionDays++;
     }
   if(firstDay)
      AppendFieldError(errors, firstErr, "sessions", "EMPTY");
   out += ",\"tradeSessionDays\":" + IntegerToString(tradeSessionDays);
   out += ",\"quoteSessionDays\":" + IntegerToString(quoteSessionDays);
   out += ",\"sessionIndexScan\":8";
   out += "}";
   return out;
  }

string BuildSymbolRecord(const string symbol)
  {
   string errors = "";
   bool firstErr = true;

   bool isCustom = false;
   bool exists = SymbolExist(symbol, isCustom);
   if(!exists)
     {
      AppendFieldError(errors, firstErr, "symbolExists", "NOT_FOUND");
     }

   long customFlag = 0;
   bool customOk = SymbolInfoInteger(symbol, SYMBOL_CUSTOM, customFlag);
   bool customSymbol = isCustom || (customOk && customFlag != 0);

   string json = "{";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"symbolExists\":" + (exists ? "true" : "false") + ",";
   json += "\"customSymbol\":" + (customSymbol ? "true" : "false") + ",";
   json += "\"description\":" + JsonStringProp(symbol, SYMBOL_DESCRIPTION, "description", errors, firstErr) + ",";
   json += "\"path\":" + JsonStringProp(symbol, SYMBOL_PATH, "path", errors, firstErr) + ",";
   json += "\"isin\":" + JsonStringProp(symbol, SYMBOL_ISIN, "isin", errors, firstErr) + ",";
   // Path + description drive classification. Sector/industry/category string APIs vary by build.
   json += "\"categoryRaw\":null,";
   json += "\"sector\":" + JsonIntProp(symbol, SYMBOL_SECTOR, "sector", errors, firstErr) + ",";
   json += "\"industry\":" + JsonIntProp(symbol, SYMBOL_INDUSTRY, "industry", errors, firstErr) + ",";
   json += "\"sectorName\":null,";
   json += "\"industryName\":null,";
   AppendFieldError(errors, firstErr, "categoryRaw", "NOT_QUERIED");
   AppendFieldError(errors, firstErr, "sectorName", "NOT_QUERIED");
   AppendFieldError(errors, firstErr, "industryName", "NOT_QUERIED");
   json += "\"selected\":" + JsonBoolProp(symbol, SYMBOL_SELECT, "selected", errors, firstErr) + ",";
   json += "\"visible\":" + JsonBoolProp(symbol, SYMBOL_VISIBLE, "visible", errors, firstErr) + ",";
   json += "\"digits\":" + JsonIntProp(symbol, SYMBOL_DIGITS, "digits", errors, firstErr) + ",";
   json += "\"point\":" + JsonDoubleProp(symbol, SYMBOL_POINT, "point", errors, firstErr) + ",";
   json += "\"tickSize\":" + JsonDoubleProp(symbol, SYMBOL_TRADE_TICK_SIZE, "tickSize", errors, firstErr) + ",";
   json += "\"tickValue\":" + JsonDoubleProp(symbol, SYMBOL_TRADE_TICK_VALUE, "tickValue", errors, firstErr) + ",";
   json += "\"tickValueProfit\":" + JsonDoubleProp(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT, "tickValueProfit", errors, firstErr) + ",";
   json += "\"tickValueLoss\":" + JsonDoubleProp(symbol, SYMBOL_TRADE_TICK_VALUE_LOSS, "tickValueLoss", errors, firstErr) + ",";
   json += "\"contractSize\":" + JsonDoubleProp(symbol, SYMBOL_TRADE_CONTRACT_SIZE, "contractSize", errors, firstErr) + ",";
   json += "\"volumeMin\":" + JsonDoubleProp(symbol, SYMBOL_VOLUME_MIN, "volumeMin", errors, firstErr) + ",";
   json += "\"volumeMax\":" + JsonDoubleProp(symbol, SYMBOL_VOLUME_MAX, "volumeMax", errors, firstErr) + ",";
   json += "\"volumeStep\":" + JsonDoubleProp(symbol, SYMBOL_VOLUME_STEP, "volumeStep", errors, firstErr) + ",";
   json += "\"volumeLimit\":" + JsonDoubleProp(symbol, SYMBOL_VOLUME_LIMIT, "volumeLimit", errors, firstErr) + ",";
   json += "\"tradeCalcMode\":" + JsonIntProp(symbol, SYMBOL_TRADE_CALC_MODE, "tradeCalcMode", errors, firstErr) + ",";
   json += "\"tradeMode\":" + JsonIntProp(symbol, SYMBOL_TRADE_MODE, "tradeMode", errors, firstErr) + ",";
   json += "\"orderMode\":" + JsonIntProp(symbol, SYMBOL_ORDER_MODE, "orderMode", errors, firstErr) + ",";
   json += "\"executionMode\":" + JsonIntProp(symbol, SYMBOL_TRADE_EXEMODE, "executionMode", errors, firstErr) + ",";
   json += "\"fillingMode\":" + JsonIntProp(symbol, SYMBOL_FILLING_MODE, "fillingMode", errors, firstErr) + ",";
   json += "\"expirationMode\":" + JsonIntProp(symbol, SYMBOL_EXPIRATION_MODE, "expirationMode", errors, firstErr) + ",";
   json += "\"stopsLevel\":" + JsonIntProp(symbol, SYMBOL_TRADE_STOPS_LEVEL, "stopsLevel", errors, firstErr) + ",";
   json += "\"freezeLevel\":" + JsonIntProp(symbol, SYMBOL_TRADE_FREEZE_LEVEL, "freezeLevel", errors, firstErr) + ",";
   json += "\"marginInitial\":" + JsonDoubleProp(symbol, SYMBOL_MARGIN_INITIAL, "marginInitial", errors, firstErr) + ",";
   json += "\"marginMaintenance\":" + JsonDoubleProp(symbol, SYMBOL_MARGIN_MAINTENANCE, "marginMaintenance", errors, firstErr) + ",";
   json += "\"marginHedged\":" + JsonDoubleProp(symbol, SYMBOL_MARGIN_HEDGED, "marginHedged", errors, firstErr) + ",";
   json += "\"marginHedgedUseLeg\":" + JsonBoolProp(symbol, SYMBOL_MARGIN_HEDGED_USE_LEG, "marginHedgedUseLeg", errors, firstErr) + ",";
   json += "\"liquidityRate\":" + JsonDoubleProp(symbol, SYMBOL_TRADE_LIQUIDITY_RATE, "liquidityRate", errors, firstErr) + ",";
   // Spread / float are static contract metadata here — not a live quote substitute.
   json += "\"spread\":" + JsonIntProp(symbol, SYMBOL_SPREAD, "spread", errors, firstErr) + ",";
   json += "\"spreadFloat\":" + JsonBoolProp(symbol, SYMBOL_SPREAD_FLOAT, "spreadFloat", errors, firstErr) + ",";
   {
      long tradeModeVal = 0;
      if(SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE, tradeModeVal))
         json += "\"tradeAllowed\":" + (tradeModeVal != SYMBOL_TRADE_MODE_DISABLED ? "true" : "false") + ",";
      else
        {
         AppendFieldError(errors, firstErr, "tradeAllowed", "UNAVAILABLE");
         json += "\"tradeAllowed\":null,";
        }
   }
   json += "\"startTime\":" + JsonIntProp(symbol, SYMBOL_START_TIME, "startTime", errors, firstErr) + ",";
   json += "\"expirationTime\":" + JsonIntProp(symbol, SYMBOL_EXPIRATION_TIME, "expirationTime", errors, firstErr) + ",";
   json += "\"currencyBase\":" + JsonStringProp(symbol, SYMBOL_CURRENCY_BASE, "currencyBase", errors, firstErr) + ",";
   json += "\"currencyProfit\":" + JsonStringProp(symbol, SYMBOL_CURRENCY_PROFIT, "currencyProfit", errors, firstErr) + ",";
   json += "\"currencyMargin\":" + JsonStringProp(symbol, SYMBOL_CURRENCY_MARGIN, "currencyMargin", errors, firstErr) + ",";
   json += "\"synchronized\":" + (SymbolIsSynchronized(symbol) ? "true" : "false") + ",";
   json += "\"sessions\":" + BuildSessionSummary(symbol, errors, firstErr) + ",";
   json += "\"fieldErrors\":{" + errors + "}";
   json += "}";
   return json;
  }

void StartCatalogDiscovery()
  {
   g_catalogRunning = true;
   g_catalogComplete = false;
   g_catalogIndex = 0;
   g_enumerated = 0;
   g_duplicateCount = 0;
   g_customCount = 0;
   g_validCount = 0;
   g_catalogStartedAt = TimeGMT();
   g_catalogCompletedAt = 0;
   g_catalogVersion = IntegerToString((long)g_catalogStartedAt);
   g_generalTotal = SymbolsTotal(false);
   g_selectedTotal = SymbolsTotal(true);
   ArrayResize(g_seenNames, 0);

   // Truncate NDJSON temp by rewrite.
   int h = FileOpen("kwizera_catalog_symbols.ndjson.tmp", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen("kwizera_catalog_symbols.ndjson.tmp", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h != INVALID_HANDLE)
      FileClose(h);

   FileDelete("kwizera_catalog.ready", FILE_COMMON);
   FileDelete("kwizera_catalog.ready");
   WriteCatalogMeta("IN_PROGRESS");
   Print("KwizeraCatalog: start general=", g_generalTotal, " selected=", g_selectedTotal);
  }

void FinishCatalogDiscovery()
  {
   // Promote tmp → final NDJSON (copy via read/write; MQL has no atomic rename).
   int src = FileOpen("kwizera_catalog_symbols.ndjson.tmp", FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(src == INVALID_HANDLE)
      src = FileOpen("kwizera_catalog_symbols.ndjson.tmp", FILE_READ|FILE_TXT|FILE_ANSI);
   int dst = FileOpen("kwizera_catalog_symbols.ndjson", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(dst == INVALID_HANDLE)
      dst = FileOpen("kwizera_catalog_symbols.ndjson", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(src != INVALID_HANDLE && dst != INVALID_HANDLE)
     {
      while(!FileIsEnding(src))
        {
         string line = FileReadString(src);
         if(StringLen(line) > 0)
           {
            FileWriteString(dst, line);
            FileWriteString(dst, "\n");
           }
        }
     }
   if(src != INVALID_HANDLE)
      FileClose(src);
   if(dst != INVALID_HANDLE)
      FileClose(dst);

   g_catalogRunning = false;
   g_catalogComplete = true;
   g_catalogCompletedAt = TimeGMT();
   WriteCatalogMeta("COMPLETE");

   int ready = FileOpen("kwizera_catalog.ready", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(ready == INVALID_HANDLE)
      ready = FileOpen("kwizera_catalog.ready", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(ready != INVALID_HANDLE)
     {
      FileWriteString(ready, g_catalogVersion);
      FileClose(ready);
     }
   Print("KwizeraCatalog: complete enumerated=", g_enumerated, " valid=", g_validCount,
         " dup=", g_duplicateCount, " custom=", g_customCount);
  }

void ProcessCatalogBatch()
  {
   if(CatalogRefreshRequested())
     {
      g_catalogComplete = false;
      g_catalogRunning = false;
      g_catalogCompletedAt = 0;
     }

   if(g_catalogComplete)
     {
      if(CatalogRefreshSec > 0 && (TimeGMT() - g_catalogCompletedAt) >= CatalogRefreshSec)
        {
         g_catalogComplete = false;
         g_catalogRunning = false;
        }
      else
         return;
     }

   if(!g_catalogRunning)
      StartCatalogDiscovery();

   int batch = CatalogBatchSize;
   if(batch < 1) batch = 1;
   if(batch > 50) batch = 50;

   int h = FileOpen("kwizera_catalog_symbols.ndjson.tmp", FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen("kwizera_catalog_symbols.ndjson.tmp", FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("KwizeraCatalog: ndjson open failed ", GetLastError());
      WriteCatalogMeta("FAILED");
      g_catalogRunning = false;
      return;
     }
   FileSeek(h, 0, SEEK_END);

   int processed = 0;
   while(processed < batch && g_catalogIndex < g_generalTotal)
     {
      string name = SymbolName(g_catalogIndex, false);
      g_catalogIndex++;
      processed++;
      if(StringLen(name) == 0)
         continue;
      if(SeenName(name))
        {
         g_duplicateCount++;
         continue;
        }
      RememberName(name);
      string rec = BuildSymbolRecord(name);
      FileWriteString(h, rec);
      FileWriteString(h, "\n");
      g_enumerated++;
      bool isCustom = false;
      if(SymbolExist(name, isCustom))
         g_validCount++;
      long customFlag = 0;
      if((isCustom) || (SymbolInfoInteger(name, SYMBOL_CUSTOM, customFlag) && customFlag != 0))
         g_customCount++;
     }
   FileClose(h);
   WriteCatalogMeta("IN_PROGRESS");

   if(g_catalogIndex >= g_generalTotal)
      FinishCatalogDiscovery();
  }

void AppendQuote(string &json, const string symbol, bool &first)
  {
   // Select only when acquiring a subscribed quote — never mass-select the catalog.
   if(!SymbolSelect(symbol, true))
      return;
   MqlTick tick;
   double bid = 0, ask = 0, last = 0;
   long tickTime = 0;
   long tickTimeMs = 0;
   long volume = 0;
   double realVolume = 0;
   ulong flags = 0;
   string acquisitionMethod = "SymbolInfoDouble";
   bool haveTick = SymbolInfoTick(symbol, tick);
   if(haveTick)
     {
      bid = tick.bid;
      ask = tick.ask;
      last = tick.last;
      tickTime = (long)tick.time;
      tickTimeMs = (long)tick.time_msc;
      volume = (long)tick.volume;
      realVolume = (double)tick.volume_real;
      flags = tick.flags;
      acquisitionMethod = "SymbolInfoTick";
     }
   else
     {
      bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
      last = SymbolInfoDouble(symbol, SYMBOL_LAST);
      tickTime = SymbolInfoInteger(symbol, SYMBOL_TIME);
     }
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   long digits = SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   long brokerSpreadPts = SymbolInfoInteger(symbol, SYMBOL_SPREAD);
   if(!first)
      json += ",";
   first = false;
   json += "{";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   // Never invent prices: emit null when Bid/Ask are non-positive.
   json += "\"bid\":" + ((bid > 0 && MathIsValidNumber(bid)) ? NumOrNull(bid) : "null") + ",";
   json += "\"ask\":" + ((ask > 0 && MathIsValidNumber(ask)) ? NumOrNull(ask) : "null") + ",";
   json += "\"last\":" + (MathIsValidNumber(last) ? NumOrNull(last) : "null") + ",";
   if(ask > 0 && bid > 0 && MathIsValidNumber(ask) && MathIsValidNumber(bid) && ask >= bid)
      json += "\"spread\":" + NumOrNull(ask - bid) + ",";
   else
      json += "\"spread\":null,";
   json += "\"brokerSpreadPoints\":" + IntegerToString(brokerSpreadPts) + ",";
   json += "\"digits\":" + IntegerToString(digits) + ",";
   json += "\"point\":" + NumOrNull(point) + ",";
   json += "\"tickSize\":" + NumOrNull(tickSize) + ",";
   json += "\"tickTime\":" + IntegerToString(tickTime) + ",";
   json += "\"tickTimeMs\":" + IntegerToString(tickTimeMs) + ",";
   json += "\"tickVolume\":" + IntegerToString(volume) + ",";
   json += "\"realVolume\":" + NumOrNull(realVolume) + ",";
   json += "\"tickFlags\":" + IntegerToString((long)flags) + ",";
   json += "\"acquisitionMethod\":\"" + acquisitionMethod + "\",";
   json += "\"provider\":\"HFM_MT5\",";
   json += "\"environment\":\"demo\"";
   json += "}";
  }

void AppendCandles(string &json, const string symbol, const ENUM_TIMEFRAMES tf, const string tfName, bool &firstTf)
  {
   if(!SymbolSelect(symbol, true))
      return;
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(symbol, tf, 0, CandleBars, rates);
   if(copied <= 0)
      return;
   if(!firstTf)
      json += ",";
   firstTf = false;
   json += "\"" + tfName + "\":[";
   bool firstBar = true;
   for(int i = copied - 1; i >= 0; i--)
     {
      if(!firstBar)
         json += ",";
      firstBar = false;
      json += "{";
      json += "\"time\":" + IntegerToString((long)rates[i].time) + ",";
      json += "\"open\":" + NumOrNull(rates[i].open) + ",";
      json += "\"high\":" + NumOrNull(rates[i].high) + ",";
      json += "\"low\":" + NumOrNull(rates[i].low) + ",";
      json += "\"close\":" + NumOrNull(rates[i].close) + ",";
      json += "\"tickVolume\":" + IntegerToString((long)rates[i].tick_volume) + ",";
      json += "\"realVolume\":" + IntegerToString((long)rates[i].real_volume) + ",";
      json += "\"spread\":" + IntegerToString((long)rates[i].spread);
      json += "}";
     }
   json += "]";
  }

void WriteSnapshot()
  {
   g_seq++;
   string login = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string server = AccountInfoString(ACCOUNT_SERVER);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   long tradeMode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   bool tradeAllowed = (bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double credit = AccountInfoDouble(ACCOUNT_CREDIT);
   double profit = AccountInfoDouble(ACCOUNT_PROFIT);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   int positions = PositionsTotal();
   int pending = OrdersTotal();

   string json = "{";
   json += "\"source\":\"mql5_readonly_snapshot\",";
   json += "\"schemaVersion\":2,";
   json += "\"seq\":" + IntegerToString((long)g_seq) + ",";
   json += "\"brokerTime\":" + IntegerToString((long)TimeCurrent()) + ",";
   json += "\"gmtTime\":" + IntegerToString((long)TimeGMT()) + ",";
   json += "\"retrievedAt\":\"" + TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + "Z\",";
   json += "\"account\":{";
   json += "\"loginExact\":\"" + JsonEscape(login) + "\",";
   json += "\"server\":\"" + JsonEscape(server) + "\",";
   json += "\"company\":\"" + JsonEscape(company) + "\",";
   json += "\"currency\":\"" + JsonEscape(currency) + "\",";
   json += "\"leverage\":\"" + IntegerToString(leverage) + "\",";
   json += "\"tradeMode\":" + IntegerToString(tradeMode) + ",";
   json += "\"tradeAllowed\":" + (tradeAllowed ? "true" : "false") + ",";
   json += "\"demoAccount\":" + ((tradeMode == ACCOUNT_TRADE_MODE_DEMO) ? "true" : "false") + ",";
   json += "\"balance\":" + NumOrNull(balance) + ",";
   json += "\"equity\":" + NumOrNull(equity) + ",";
   json += "\"credit\":" + NumOrNull(credit) + ",";
   json += "\"profit\":" + NumOrNull(profit) + ",";
   json += "\"usedMargin\":" + NumOrNull(margin) + ",";
   json += "\"freeMargin\":" + NumOrNull(freeMargin) + ",";
   json += "\"marginLevel\":" + NumOrNull(marginLevel) + ",";
   json += "\"openPositionsCount\":" + IntegerToString(positions) + ",";
   json += "\"pendingOrdersCount\":" + IntegerToString(pending);
   json += "},";

   // Core quote universe + bounded STEP 2 chart-context extras (never full catalog).
   json += "\"quotes\":[";
   bool firstQ = true;
   string candidates[] = {"EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","XAUUSD","XAGUSD"};
   for(int i=0;i<ArraySize(candidates);i++)
      AppendQuote(json, candidates[i], firstQ);
   for(int ei=0; ei<ArraySize(g_extraQuotes); ei++)
     {
      string esym = g_extraQuotes[ei];
      bool already = false;
      for(int ci=0; ci<ArraySize(candidates); ci++)
        {
         if(candidates[ci] == esym)
           {
            already = true;
            break;
           }
        }
      if(!already)
         AppendQuote(json, esym, firstQ);
     }
   json += "],";
   json += "\"expertVersion\":\"1.40\",";

   int everyN = CandleEveryN;
   if(everyN < 1) everyN = 1;
   bool includeCandles = ((long)g_seq % everyN) == 1;
   json += "\"candlesIncluded\":" + (includeCandles ? "true" : "false") + ",";
   if(includeCandles)
     {
      // Quote-universe symbols only (not full catalog). Keep CopyRates bounded.
      string candleSymbols[] = {"EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","XAUUSD","XAGUSD"};
      string candlesObj = "{";
      bool firstSym = true;
      for(int si=0; si<ArraySize(candleSymbols); si++)
        {
         string csym = candleSymbols[si];
         string tfJson = "";
         bool firstTf = true;
         AppendCandles(tfJson, csym, PERIOD_M1, "M1", firstTf);
         AppendCandles(tfJson, csym, PERIOD_M5, "M5", firstTf);
         AppendCandles(tfJson, csym, PERIOD_M15, "M15", firstTf);
         AppendCandles(tfJson, csym, PERIOD_M30, "M30", firstTf);
         AppendCandles(tfJson, csym, PERIOD_H1, "H1", firstTf);
         AppendCandles(tfJson, csym, PERIOD_H4, "H4", firstTf);
         AppendCandles(tfJson, csym, PERIOD_D1, "D1", firstTf);
         if(StringLen(tfJson) <= 0)
            continue;
         if(!firstSym)
            candlesObj += ",";
         firstSym = false;
         candlesObj += "\"" + csym + "\":{" + tfJson + "}";
        }
      candlesObj += "}";
      json += "\"candles\":" + candlesObj + ",";

      // Durable candle artifact so agent can serve history between quote-only snapshots.
      string candleDoc = "{";
      candleDoc += "\"source\":\"mql5_readonly_candles\",";
      candleDoc += "\"provider\":\"HFM_MT5\",";
      candleDoc += "\"environment\":\"demo\",";
      candleDoc += "\"schemaVersion\":1,";
      candleDoc += "\"seq\":" + IntegerToString((long)g_seq) + ",";
      candleDoc += "\"brokerTime\":" + IntegerToString((long)TimeCurrent()) + ",";
      candleDoc += "\"gmtTime\":" + IntegerToString((long)TimeGMT()) + ",";
      candleDoc += "\"retrievedAt\":\"" + TimeToString(TimeGMT(), TIME_DATE|TIME_SECONDS) + "Z\",";
      candleDoc += "\"candles\":" + candlesObj;
      candleDoc += "}";
      int hc = FileOpen("kwizera_readonly_candles.json", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
      if(hc == INVALID_HANDLE)
         hc = FileOpen("kwizera_readonly_candles.json", FILE_WRITE|FILE_TXT|FILE_ANSI);
      if(hc != INVALID_HANDLE)
        {
         FileWriteString(hc, candleDoc);
         FileClose(hc);
        }
     }
   else
     {
      json += "\"candles\":{},";
     }

   json += "\"catalogDiscoveryStatus\":\"" + (g_catalogComplete ? "COMPLETE" : (g_catalogRunning ? "IN_PROGRESS" : "IDLE")) + "\",";
   json += "\"catalogEnumerated\":" + IntegerToString(g_enumerated) + ",";
   json += "\"catalogGeneralTotal\":" + IntegerToString(g_generalTotal) + ",";
   json += "\"ordersEnabled\":false,";
   json += "\"note\":\"Periodic read-only snapshot. No OrderSend. Catalog is a separate artifact.\"";
   json += "}";

   int h = FileOpen("kwizera_readonly_snapshot.json", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen("kwizera_readonly_snapshot.json", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("KwizeraReadonlySnapshot: FileOpen failed ", GetLastError());
      return;
     }
   FileWriteString(h, json);
   FileClose(h);
  }

int OnInit()
  {
   int sec = SnapshotIntervalSec;
   if(sec < 2) sec = 2;
   if(sec > 30) sec = 30;
   EventSetTimer(sec);
   WriteSnapshot();
   // Kick catalog after first quote snapshot so login/account path stays responsive.
   ProcessCatalogBatch();
   Print("KwizeraReadonlySnapshot: v1.40 timer=", sec, "s login=", AccountInfoInteger(ACCOUNT_LOGIN),
         " catalogBatch=", CatalogBatchSize);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   // On-demand history/ticks before snapshot so agent waiters see responses quickly.
   ProcessAcquisitionRequests();
   // Quotes/account first — catalog batches must not starve the existing engine.
   WriteSnapshot();
   ProcessCatalogBatch();
  }

void OnTick()
  {
   // Chart-symbol event tick (lightweight). Multi-symbol still uses timer SymbolInfoTick.
   WriteChartTick();
  }
