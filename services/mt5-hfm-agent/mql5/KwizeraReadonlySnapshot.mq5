//+------------------------------------------------------------------+
//| KwizeraReadonlySnapshot.mq5                                      |
//| Phase 1 — periodic read-only HFM Demo account + quotes + candles |
//| NEVER calls OrderSend / PositionClose / trade functions.         |
//+------------------------------------------------------------------+
#property copyright "KWIZERA AI STUDIO"
#property version   "1.10"
#property strict
#property description "Periodic read-only snapshot. No trading."

#include <Trade/AccountInfo.mqh>

input int SnapshotIntervalSec = 3;   // Timer interval (seconds)
input int CandleBars = 48;           // Bars per timeframe (bounded for VPS)
input int CandleEveryN = 10;         // Write candles every N snapshots (CPU/disk)

ulong g_seq = 0;

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
   // Emit oldest→newest for consumers.
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

   json += "\"quotes\":[";
   bool firstQ = true;
   string candidates[] = {"EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","XAUUSD","XAGUSD"};
   for(int i=0;i<ArraySize(candidates);i++)
      AppendQuote(json, candidates[i], firstQ);
   json += "],";

   // Candles for EURUSD + XAUUSD only, throttled (resource bound on 1-vCPU VPS).
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

   json += "\"ordersEnabled\":false,";
   json += "\"note\":\"Periodic read-only snapshot. No OrderSend.\"}";

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
   Print("KwizeraReadonlySnapshot: timer=", sec, "s login=", AccountInfoInteger(ACCOUNT_LOGIN));
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   WriteSnapshot();
  }

void OnTick()
  {
   // Timer-driven acquisition preferred for 1-vCPU VPS (avoids per-tick JSON rebuild).
  }
