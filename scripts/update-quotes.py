#!/usr/bin/env python3
"""Public market data only; never reads holdings or user information."""
import concurrent.futures
import datetime as dt
import json
import math
from pathlib import Path
import urllib.request

TARGET = Path(__file__).resolve().parents[1] / 'public/data/quotes.json'
CATALOG = [
    ('bitcoin', 'Bitcoin', 'BTC', 'cripto', 'coingecko'),
    ('ethereum', 'Ethereum', 'ETH', 'cripto', 'coingecko'),
    ('solana', 'Solana', 'SOL', 'cripto', 'coingecko'),
    ('USD', 'Dólar estadounidense', 'USD', 'divisa', 'frankfurter'),
    ('GBP', 'Libra esterlina', 'GBP', 'divisa', 'frankfurter'),
    ('CHF', 'Franco suizo', 'CHF', 'divisa', 'frankfurter'),
    ('JPY', 'Yen japonés', 'JPY', 'divisa', 'frankfurter'),
    ('AAPL', 'Apple', 'AAPL', 'accion', 'yahoo'),
    ('MSFT', 'Microsoft', 'MSFT', 'accion', 'yahoo'),
    ('NVDA', 'NVIDIA', 'NVDA', 'accion', 'yahoo'),
    ('GOOGL', 'Alphabet', 'GOOGL', 'accion', 'yahoo'),
    ('SPY', 'SPDR S&P 500 ETF', 'SPY', 'fondo', 'yahoo'),
    ('VWCE.DE', 'Vanguard FTSE All-World ETF', 'VWCE', 'fondo', 'yahoo'),
]

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Neto/0.1 (public market data)'})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)

def iso(timestamp):
    return dt.datetime.fromtimestamp(timestamp, dt.timezone.utc).isoformat().replace('+00:00', 'Z')

def price(value):
    if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError('Invalid market price')
    return value

previous = {}
if TARGET.exists():
    previous = {q['id']: q for q in json.loads(TARGET.read_text())['activos']}
# Recover the latest published feed when a provider is temporarily unavailable.
try:
    live = fetch('https://victxrchaves-pixel.github.io/App-Gesti-n-Financiera/data/quotes.json')
    for q in live.get('activos', []):
        if q['id'] not in previous or q['fecha'] > previous[q['id']]['fecha']:
            previous[q['id']] = q
except Exception:
    pass

errors = []
# Historial diario de un año para los gráficos de mercado (1S, 1M, 3M, 1A).
HISTORY_DAYS = 365
start = (dt.date.today() - dt.timedelta(days=HISTORY_DAYS + 5)).isoformat()
try:
    fx_history = fetch('https://api.frankfurter.app/' + start + '..' + dt.date.today().isoformat() + '?from=EUR&to=USD,GBP,CHF,JPY')['rates']
except Exception:
    fx_history = {}
try:
    fx = fetch('https://api.frankfurter.app/latest?from=EUR')
except Exception as exc:
    fx = None
    errors.append('Frankfurter: ' + str(exc))
try:
    crypto = fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=eur&include_last_updated_at=true')
except Exception as exc:
    crypto = {}
    errors.append('CoinGecko: ' + str(exc))

def quote(item):
    key, name, symbol, kind, provider = item
    try:
        history = []
        if provider == 'coingecko':
            p = price(crypto[key]['eur']); date = iso(crypto[key]['last_updated_at']); source = 'CoinGecko'
            try:
                market = fetch('https://api.coingecko.com/api/v3/coins/' + key + '/market_chart?vs_currency=eur&days=' + str(HISTORY_DAYS) + '&interval=daily')
                daily = {iso(t / 1000)[:10]: price(v) for t, v in market['prices']}
                history = [{'fecha': day, 'precioEUR': value} for day, value in sorted(daily.items())]
            except Exception:
                history = previous.get(key, {}).get('historial', [])
        elif provider == 'frankfurter':
            p = 1 / price(fx['rates'][key]); date = fx['date']; source = 'Frankfurter / BCE'
            history = [{'fecha': day, 'precioEUR': 1 / price(rates[key])} for day, rates in sorted(fx_history.items()) if key in rates]
        else:
            data = fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + key + '?range=1y&interval=1d')
            result = data['chart']['result'][0]
            meta = result['meta']
            currency = meta['currency']
            if currency != 'EUR' and (fx is None or currency not in fx['rates']):
                raise ValueError('Missing EUR conversion')
            p = price(meta['regularMarketPrice']) / (1 if currency == 'EUR' else price(fx['rates'][currency]))
            date = iso(meta['regularMarketTime']); source = 'Yahoo Finance'
            if currency != 'EUR':
                source += ' · cambio BCE ' + fx['date']
            for timestamp, close in zip(result.get('timestamp', []), result['indicators']['quote'][0]['close']):
                if close is None:
                    continue
                day = iso(timestamp)[:10]
                available = [d for d in fx_history if d <= day]
                rate = 1 if currency == 'EUR' else fx_history[max(available)].get(currency) if available else None
                if rate:
                    history.append({'fecha': day, 'precioEUR': price(close) / price(rate)})
        # Precios con 8 cifras significativas: suficiente para cripto y divisas y el archivo pesa menos.
        history = [{'fecha': h['fecha'], 'precioEUR': float('%.8g' % h['precioEUR'])} for h in history]
        return {'id': key, 'nombre': name, 'simbolo': symbol, 'tipo': kind, 'precioEUR': price(p), 'fecha': date, 'fuente': source, 'historial': history}
    except Exception as exc:
        errors.append(key + ': ' + str(exc))
        return previous.get(key)

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    quotes = [q for q in pool.map(quote, CATALOG) if q]
if not quotes:
    raise SystemExit('No usable prices available; retaining the previous deployment.')
result = {'generadoEn': dt.datetime.now(dt.timezone.utc).isoformat(), 'activos': quotes}
TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Prepared {len(quotes)} market quotes. Individual source timestamps are retained.')
for error in errors:
    print('Provider warning: ' + error)
