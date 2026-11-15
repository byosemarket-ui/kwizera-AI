//+------------------------------------------------------------------+
//| KwizeraReadonlySnapshot.mq5                                      |
//| Read-only Demo account + Market Watch dump for KWIZERA agent.    |
//| NEVER calls OrderSend / PositionClose / trade functions.         |
//+------------------------------------------------------------------+
#property copyright "KWIZERA AI STUDIO"
#property version   "1.00"
#property strict
#property description "Read-only snapshot writer. No trading."

#include <Trade/AccountInfo.mqh>

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

void AppendQuote(string &json, const string symbol, const bool first)
  {
   if(!SymbolSelect(symbol, true))
      return;
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   long digits = SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   long time = SymbolInfoInteger(symbol, SYMBOL_TIME);
   if(!first)
      json += ",";
   json += "{";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"bid\":" + NumOrNull(bid) + ",";
   json += "\"ask\":" + NumOrNull(ask) + ",";
   json += "\"spread\":" + NumOrNull((ask > 0 && bid > 0) ? (ask - bid) : 0) + ",";
   json += "\"digits\":" + IntegerToString(digits) + ",";
   json += "\"point\":" + NumOrNull(point) + ",";
   json += "\"tickTime\":" + IntegerToString(time);
   json += "}";
  }

int OnInit()
  {
   // Hard refuse any trading API usage path — this EA never trades.
   if(MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      // Even if algo trading is on, we still only write a file.
     }

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

   string json = "{";
   json += "\"source\":\"mql5_readonly_snapshot\",";
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
   json += "\"marginLevel\":" + NumOrNull(marginLevel);
   json += "},";
   json += "\"quotes\":[";
   bool first = true;
   string watch[];
   ArrayResize(watch, 0);
   // Prefer common FX + metals; skip missing symbols silently.
   string candidates[] = {"EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","XAUUSD","XAGUSD"};
   for(int i=0;i<ArraySize(candidates);i++)
     {
      int before = StringLen(json);
      AppendQuote(json, candidates[i], first);
      if(StringLen(json) > before)
         first = false;
     }
   json += "],";
   json += "\"ordersEnabled\":false,";
   json += "\"note\":\"Read-only snapshot. No OrderSend.\"}";

   int h = FileOpen("kwizera_readonly_snapshot.json", FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h == INVALID_HANDLE)
      h = FileOpen("kwizera_readonly_snapshot.json", FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      Print("KwizeraReadonlySnapshot: FileOpen failed ", GetLastError());
      ExpertRemove();
      return(INIT_FAILED);
     }
   FileWriteString(h, json);
   FileClose(h);
   Print("KwizeraReadonlySnapshot: wrote snapshot for login ", login);
   ExpertRemove();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason) {}
void OnTick() {}
