import json, urllib.request, sys, time
out = sys.argv[1]
vars_ = "631|673|834|835|839|810|811"
rows = []
for anos in ["2007-2011","2012-2016","2017-2020","2021-2023"]:
    url = f"https://servicodados.ibge.gov.br/api/v3/agregados/1849/periodos/{anos}/variaveis/{vars_}?localidades=N3[all]&classificacao=12762[all]"
    for tent in range(4):
        try:
            d = json.load(urllib.request.urlopen(url, timeout=120)); break
        except Exception as e:
            print("erro", anos, e); time.sleep(5)
    for v in d:
        for r in v["resultados"]:
            cat = list(r["classificacoes"][0]["categoria"].items())[0]
            for s in r["series"]:
                for ano, val in s["serie"].items():
                    rows.append([v["id"], cat[0], cat[1], s["localidade"]["id"], s["localidade"]["nome"], ano, val])
    print(anos, len(rows))
import csv
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["var","cnae_id","cnae","uf_id","uf","ano","valor"]); w.writerows(rows)
