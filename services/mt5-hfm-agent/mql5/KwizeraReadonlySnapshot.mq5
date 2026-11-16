//+------------------------------------------------------------------+
//| KwizeraReadonlySnapshot.mq5                                      |
//| Read-only HFM Demo: account + quotes + candles + symbol catalog  |
//| NEVER calls OrderSend / PositionClose / trade functions.         |
//| Catalog discovery does NOT mass-SymbolSelect the universe.       |
//+------------------------------------------------------------------+
#property copyright "KWIZERA AI STUDIO"
#property version   "1.21"
#property description "Periodic read-only snapshot + batched catalog. No trading."

#include <Trade/AccountInfo.mqh>

input int SnapshotIntervalSec = 3;     // Quote/account timer (seconds)
input int CandleBars = 48;             // Bars per timeframe (bounded for VPS)
input int CandleEveryN = 10;           // Write candles every N snapshots
input int CatalogBatchSize = 20;       // Symbols per timer tick (catalog)
input int CatalogRefreshSec = 21600;   // Full rediscovery interval (6h)

ulong g_seq = 0;

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
   // Lightweight: day 0..6, session index 0 only (quote + trade). No SymbolSelect.
   string out = "{";
   bool firstDay = true;
   int tradeSessions = 0;
   int quoteSessions = 0;
   for(int day = 0; day <= 6; day++)
     {
      datetime fromT = 0;
      datetime toT = 0;
      bool hasTrade = SymbolInfoSessionTrade(symbol, (ENUM_DAY_OF_WEEK)day, 0, fromT, toT);
      datetime qFrom = 0;
      datetime qTo = 0;
      bool hasQuote = SymbolInfoSessionQuote(symbol, (ENUM_DAY_OF_WEEK)day, 0, qFrom, qTo);
      if(hasTrade)
         tradeSessions++;
      if(hasQuote)
         quoteSessions++;
      if(!hasTrade && !hasQuote)
         continue;
      if(!firstDay)
         out += ",";
      firstDay = false;
      out += "\"" + IntegerToString(day) + "\":{";
      if(hasTrade)
        {
         out += "\"tradeFrom\":" + IntegerToString((long)fromT) + ",";
         out += "\"tradeTo\":" + IntegerToString((long)toT);
        }
      else
        {
         out += "\"tradeFrom\":null,\"tradeTo\":null";
        }
      out += ",";
      if(hasQuote)
        {
         out += "\"quoteFrom\":" + IntegerToString((long)qFrom) + ",";
         out += "\"quoteTo\":" + IntegerToString((long)qTo);
        }
      else
        {
         out += "\"quoteFrom\":null,\"quoteTo\":null";
        }
      out += "}";
     }
   if(firstDay)
      AppendFieldError(errors, firstErr, "sessions", "EMPTY");
   out += ",\"tradeSessionDays\":" + IntegerToString(tradeSessions);
   out += ",\"quoteSessionDays\":" + IntegerToString(quoteSessions);
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
   if(!SymbolSelect(symbol, true))
      return;
   MqlTick tick;
   double bid = 0, ask = 0, last = 0;
   long tickTime = 0;
   long volume = 0;
   if(SymbolInfoTick(symbol, tick))
     {
      bid = tick.bid;
      ask = tick.ask;
      last = tick.last;
      tickTime = (long)tick.time;
      volume = (long)tick.volume;
     }
   else
     {
      bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
      last = SymbolInfoDouble(symbol, SYMBOL_LAST);
      tickTime = SymbolInfoInteger(symbol, SYMBOL_TIME);
     }
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   long digits = SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(!first)
      json += ",";
   first = false;
   json += "{";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"bid\":" + NumOrNull(bid) + ",";
   json += "\"ask\":" + NumOrNull(ask) + ",";
   json += "\"last\":" + NumOrNull(last) + ",";
   json += "\"spread\":" + NumOrNull((ask > 0 && bid > 0) ? (ask - bid) : 0) + ",";
   json += "\"digits\":" + IntegerToString(digits) + ",";
   json += "\"point\":" + NumOrNull(point) + ",";
   json += "\"tickTime\":" + IntegerToString(tickTime) + ",";
   json += "\"tickVolume\":" + IntegerToString(volume);
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

   // Existing quote engine universe (NOT the catalog). Kept intact for Phase 1.
   json += "\"quotes\":[";
   bool firstQ = true;
   string candidates[] = {"EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","XAUUSD","XAGUSD"};
   for(int i=0;i<ArraySize(candidates);i++)
      AppendQuote(json, candidates[i], firstQ);
   json += "],";

   int everyN = CandleEveryN;
   if(everyN < 1) everyN = 1;
   bool includeCandles = ((long)g_seq % everyN) == 1;
   json += "\"candlesIncluded\":" + (includeCandles ? "true" : "false") + ",";
   if(includeCandles)
     {
      json += "\"candles\":{";
      json += "\"EURUSD\":{";
      bool firstTf = true;
      AppendCandles(json, "EURUSD", PERIOD_M1, "M1", firstTf);
      AppendCandles(json, "EURUSD", PERIOD_M5, "M5", firstTf);
      AppendCandles(json, "EURUSD", PERIOD_M15, "M15", firstTf);
      AppendCandles(json, "EURUSD", PERIOD_M30, "M30", firstTf);
      AppendCandles(json, "EURUSD", PERIOD_H1, "H1", firstTf);
      AppendCandles(json, "EURUSD", PERIOD_H4, "H4", firstTf);
      AppendCandles(json, "EURUSD", PERIOD_D1, "D1", firstTf);
      json += "},";
      json += "\"XAUUSD\":{";
      firstTf = true;
      AppendCandles(json, "XAUUSD", PERIOD_M1, "M1", firstTf);
      AppendCandles(json, "XAUUSD", PERIOD_M5, "M5", firstTf);
      AppendCandles(json, "XAUUSD", PERIOD_M15, "M15", firstTf);
      AppendCandles(json, "XAUUSD", PERIOD_M30, "M30", firstTf);
      AppendCandles(json, "XAUUSD", PERIOD_H1, "H1", firstTf);
      AppendCandles(json, "XAUUSD", PERIOD_H4, "H4", firstTf);
      AppendCandles(json, "XAUUSD", PERIOD_D1, "D1", firstTf);
      json += "}";
      json += "},";
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
   Print("KwizeraReadonlySnapshot: timer=", sec, "s login=", AccountInfoInteger(ACCOUNT_LOGIN),
         " catalogBatch=", CatalogBatchSize);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   // Quotes/account first — catalog batches must not starve the existing engine.
   WriteSnapshot();
   ProcessCatalogBatch();
  }

void OnTick()
  {
   // Timer-driven acquisition preferred for 1-vCPU VPS (avoids per-tick JSON rebuild).
  }
