#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pré-processamento público do Dashboard Amazônia Azul.

Uso recomendado:
  1. Mantenha os arquivos brutos fora do repositório público, em data/raw/ ou /mnt/data.
  2. Rode: python scripts/preprocessar_dados.py
  3. Publique apenas data/processed/*.json e os arquivos de código do dashboard.

O script gera JSON agregado e codificado. Nenhum registro individual da base bruta é
publicado. Para bases Excel grandes, recomenda-se converter localmente para CSV com
LibreOffice antes do processamento; se o CSV existir, ele será usado automaticamente.
"""
from __future__ import annotations
import csv, json, math, re, subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / 'data' / 'raw'
PROCESSED = ROOT / 'data' / 'processed'
PROCESSED.mkdir(parents=True, exist_ok=True)

FNE_XLSX = Path('/mnt/data/FNE_AnexoI_Contratações_032026.xlsx')
TIP_XLSX = Path('/mnt/data/Tipologia Amazônia Azul (v5).xlsx')
LOCAL_CSV = Path('/mnt/data/lo_csv/FNE_AnexoI_Contratações_032026.csv')

MACRO={'AC':'Norte','AP':'Norte','AM':'Norte','PA':'Norte','RO':'Norte','RR':'Norte','TO':'Norte','AL':'Nordeste','BA':'Nordeste','CE':'Nordeste','MA':'Nordeste','PB':'Nordeste','PE':'Nordeste','PI':'Nordeste','RN':'Nordeste','SE':'Nordeste','DF':'Centro-Oeste','GO':'Centro-Oeste','MT':'Centro-Oeste','MS':'Centro-Oeste','ES':'Sudeste','MG':'Sudeste','RJ':'Sudeste','SP':'Sudeste','PR':'Sul','RS':'Sul','SC':'Sul'}
SCHEMA=['fundo','uf','codMun','municipio','macro','tipologiaPndr','tipologiaTerritorial','elegivel','atividadeAzul','pfPj','anoMes','setor','programa','linha','atividade','cnae','porte','finalidade','instituicao','sexo','valor','beneficiarios','contratos','registros']
CAT_FIELDS=['fundo','uf','municipio','macro','tipologiaPndr','tipologiaTerritorial','atividadeAzul','pfPj','anoMes','setor','programa','linha','atividade','cnae','porte','finalidade','instituicao','sexo']
CAT_SET=set(CAT_FIELDS)

REQUIRED=['UF','CÓDIGO DE MUNICÍPIO','NOME DO MUNICÍPIO','TIPOLOGIA MUNICÍPIO','TIPOLOGIA AMAZÔNIA AZUL','PESSOA FISICA JURÍDICA','DATA DA CONTRATAÇÃO','CNAE','SETOR','PROGRAMA','LINHA DE FINANCIAMENTO','ATIVIDADE','PORTE','FINALIDADE DA OPERAÇÃO','QTDE DE BENEFICIÁRIOS','QUANTIDADE DE CONTRATOS','VALOR CONTRATADO','INSTITUIÇÃO OPERADORA','SEXO']


def clean(x: Any, default='Não informado') -> str:
    if x is None: return default
    s=str(x).strip()
    if not s or s.lower() in ('nan','none','null'): return default
    return re.sub(r'\s+',' ',s)

def norm_cod(x: Any) -> str:
    s=clean(x,'')
    dig=re.sub(r'\D','',s)
    return dig.zfill(7) if dig else ''

def to_float(x: Any) -> float:
    if x is None: return 0.0
    if isinstance(x,(int,float)) and not isinstance(x,bool):
        return 0.0 if (isinstance(x,float) and math.isnan(x)) else float(x)
    s=str(x).strip().replace('.','').replace(',','.')
    try: return float(s)
    except Exception: return 0.0

def to_period(x: Any) -> str:
    s=clean(x,'')
    m=re.match(r'^(\d{1,2})[/-](\d{4})$',s)
    if m: return f'{int(m.group(2)):04d}-{int(m.group(1)):02d}'
    m=re.match(r'^(\d{4})[/-](\d{1,2})',s)
    if m: return f'{int(m.group(1)):04d}-{int(m.group(2)):02d}'
    return 'Sem data'

def norm_sexo(x: Any) -> str:
    s=clean(x).upper()
    if s in ('F','FEMININO','MULHER','MULHERES'): return 'Mulheres'
    if s in ('M','MASCULINO','HOMEM','HOMENS'): return 'Homens'
    return 'Não informado / PJ / não aplicável'

def norm_azul(x: Any) -> str:
    return 'Sim' if clean(x).lower() in ('sim','s','1','true','verdadeiro') else 'Não'

def read_tipologia(path: Path):
    wb=load_workbook(path,read_only=True,data_only=True)
    ws=wb['Base de dados']
    header=next(ws.iter_rows(min_row=1,max_row=1,values_only=True))
    idx={h:i for i,h in enumerate(header)}
    out={}
    for r in ws.iter_rows(min_row=2,values_only=True):
        cod=norm_cod(r[idx['Código de município']])
        if cod:
            out[cod]={'municipio':clean(r[idx['Nome de município']]), 'uf':clean(r[idx['UF']]), 'tipologia':clean(r[idx['Tipologia Amazônia Azul']])}
    return out

def ensure_csv():
    if LOCAL_CSV.exists(): return LOCAL_CSV
    csv_path=RAW_DIR/'FNE_AnexoI_Contratações_032026.csv'
    if csv_path.exists(): return csv_path
    xlsx=RAW_DIR/'FNE_AnexoI_Contratações_032026.xlsx'
    if not xlsx.exists() and FNE_XLSX.exists(): xlsx=FNE_XLSX
    if not xlsx.exists(): raise FileNotFoundError('Não encontrei o Excel bruto em data/raw/ nem em /mnt/data.')
    outdir=RAW_DIR/'_csv_convertido'; outdir.mkdir(parents=True,exist_ok=True)
    subprocess.run(['libreoffice','--headless','--convert-to','csv','--outdir',str(outdir),str(xlsx)], check=True)
    conv=outdir/(xlsx.stem+'.csv')
    if not conv.exists(): raise FileNotFoundError('Falha na conversão do Excel para CSV.')
    return conv

def encode(agg):
    lookups={f:[] for f in CAT_FIELDS}; idx={f:{} for f in CAT_FIELDS}
    def enc(f,v):
        v=clean(v)
        d=idx[f]
        if v not in d:
            d[v]=len(lookups[f]); lookups[f].append(v)
        return d[v]
    rows=[]
    for key, vals in agg.items():
        rec=list(key)+vals
        out=[]
        for name, v in zip(SCHEMA, rec):
            if name in CAT_SET: out.append(enc(name,v))
            elif name=='codMun': out.append(str(v))
            elif name in ('elegivel','registros'): out.append(int(v))
            else: out.append(round(float(v),2))
        rows.append(out)
    return {'schema':SCHEMA,'cat_fields':CAT_FIELDS,'lookups':lookups,'rows':rows}

def main():
    tip_path=TIP_XLSX if TIP_XLSX.exists() else RAW_DIR/'Tipologia Amazônia Azul (v5).xlsx'
    tipologia=read_tipologia(tip_path)
    csv_path=ensure_csv()
    key_fields=SCHEMA[:-4]
    agg=defaultdict(lambda:[0.0,0.0,0.0,0])
    n=0
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader=csv.DictReader(f)
        missing=[c for c in REQUIRED if c not in reader.fieldnames]
        if missing: raise RuntimeError(f'Colunas obrigatórias ausentes: {missing}')
        for r in reader:
            cod=norm_cod(r['CÓDIGO DE MUNICÍPIO'])
            uf=clean(r['UF'],'UF não informada')
            eleg=1 if cod in tipologia else 0
            ti=tipologia.get(cod,{})
            rec={
                'fundo':'FNE','uf':uf,'codMun':cod,'municipio':clean(r['NOME DO MUNICÍPIO'],ti.get('municipio','Não informado')),
                'macro':MACRO.get(uf,'Não informado'),'tipologiaPndr':clean(r['TIPOLOGIA MUNICÍPIO']),'tipologiaTerritorial':ti.get('tipologia','Não elegível'),
                'elegivel':eleg,'atividadeAzul':norm_azul(r['TIPOLOGIA AMAZÔNIA AZUL']),'pfPj':clean(r['PESSOA FISICA JURÍDICA']),'anoMes':to_period(r['DATA DA CONTRATAÇÃO']),
                'setor':clean(r['SETOR']),'programa':clean(r['PROGRAMA']),'linha':clean(r['LINHA DE FINANCIAMENTO']),'atividade':clean(r['ATIVIDADE']),'cnae':clean(r['CNAE']),'porte':clean(r['PORTE']),'finalidade':clean(r['FINALIDADE DA OPERAÇÃO']),'instituicao':clean(r['INSTITUIÇÃO OPERADORA']),'sexo':norm_sexo(r['SEXO'])
            }
            key=tuple(rec[k] for k in key_fields)
            a=agg[key]
            a[0]+=to_float(r['VALOR CONTRATADO']); a[1]+=to_float(r['QTDE DE BENEFICIÁRIOS']); a[2]+=to_float(r['QUANTIDADE DE CONTRATOS']); a[3]+=1
            n+=1
    payload=encode(agg)
    payload['metadata']={'versao':'publico-agregado-v2-ajustes','fonte_inicial':csv_path.name,'linhas_brutas_processadas':n,'linhas_agregadas_publicas':len(payload['rows']),'municipios_elegiveis_tipologia':len(tipologia),'observacao':'Arquivo público agregado e codificado; a base bruta não é publicada.'}
    out=PROCESSED/'operacoes_agregadas_publicas.json'
    out.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    for name in ['series_temporais.json','agregados_territoriais.json','agregados_dimensoes.json','benchmarking.json']:
        (PROCESSED/name).write_text(json.dumps({'source':'operacoes_agregadas_publicas.json','note':'Cálculo derivado no navegador a partir do arquivo público agregado codificado.'},ensure_ascii=False),encoding='utf-8')
    tip_json=[{'codMun':k,**v} for k,v in tipologia.items()]
    (PROCESSED/'tipologia_amazonia_azul.json').write_text(json.dumps(tip_json,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Processados {n:,} registros; {len(payload["rows"]):,} linhas agregadas; {out.stat().st_size/1024/1024:.2f} MB')
if __name__=='__main__': main()
