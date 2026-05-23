#!/usr/bin/env python3
"""
Pré-processa planilhas dos fundos para publicação pública no dashboard Amazônia Azul.

Uso básico:
  python scripts/preprocessar_dados.py \
    --base-bruta caminho/FNE_AnexoI_Contratações_032026.xlsx \
    --tipologia caminho/Tipologia\ Amazônia\ Azul\ \(v5\).xlsx \
    --saida data/processed/operacoes_agregadas_fne_2026_03.json \
    --saida-tipologia data/processed/tipologia_amazonia_azul.json \
    --fundo FNE \
    --periodo 2026-03

O script usa apenas bibliotecas padrão do Python para ler XLSX por XML interno.
Ele não publica a base bruta; gera JSON agregado e compacto.
"""
from zipfile import ZipFile
from xml.etree.ElementTree import iterparse, parse
from pathlib import Path
from collections import defaultdict
import argparse, json, re, unicodedata

NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
UF_TO_MACRO={'AC':'Norte','AP':'Norte','AM':'Norte','PA':'Norte','RO':'Norte','RR':'Roraima','TO':'Norte','AL':'Nordeste','BA':'Nordeste','CE':'Nordeste','MA':'Nordeste','PB':'Nordeste','PE':'Nordeste','PI':'Nordeste','RN':'Nordeste','SE':'Nordeste','DF':'Centro-Oeste','GO':'Centro-Oeste','MT':'Centro-Oeste','MS':'Centro-Oeste','ES':'Sudeste','MG':'Sudeste','RJ':'Sudeste','SP':'Sudeste','PR':'Sul','RS':'Sul','SC':'Sul'}
UF_TO_MACRO['RR']='Norte'

def load_shared(z):
    ss=[]
    if 'xl/sharedStrings.xml' not in z.namelist(): return ss
    with z.open('xl/sharedStrings.xml') as f:
        for _,el in iterparse(f, events=('end',)):
            if el.tag==NS+'si':
                ss.append(''.join([(t.text or '') for t in el.iter(NS+'t')]))
                el.clear()
    return ss

def col_idx(ref):
    letters=''.join([c for c in ref if c.isalpha()]); n=0
    for ch in letters: n=n*26+ord(ch.upper())-64
    return n-1

def sheet_path_by_name(z, sheet_name):
    wb=parse(z.open('xl/workbook.xml')).getroot(); rels=parse(z.open('xl/_rels/workbook.xml.rels')).getroot()
    relmap={rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
    for s in wb.find(NS+'sheets'):
        if s.attrib.get('name')==sheet_name:
            target=relmap[s.attrib.get(R+'id')]
            if target.startswith('/'): target=target[1:]
            return target if target.startswith('xl/') else 'xl/'+target
    raise KeyError(f'Aba não encontrada: {sheet_name}')

def iter_sheet_dicts(path, sheet_name):
    with ZipFile(path) as z:
        sp=sheet_path_by_name(z, sheet_name); ss=load_shared(z); header=None; cur=[]
        with z.open(sp) as f:
            for _,el in iterparse(f, events=('end',)):
                if el.tag==NS+'c':
                    idx=col_idx(el.attrib.get('r','A'))
                    while len(cur)<=idx: cur.append('')
                    t=el.attrib.get('t'); ve=el.find(NS+'v')
                    if t=='s' and ve is not None: val=ss[int(ve.text)]
                    elif t=='inlineStr': val=''.join([x.text or '' for x in el.iter(NS+'t')])
                    elif ve is not None: val=ve.text or ''
                    else: val=''
                    cur[idx]=val; el.clear()
                elif el.tag==NS+'row':
                    row=cur; cur=[]; el.clear()
                    if header is None:
                        header=[str(x).strip() for x in row]; continue
                    if not any(row): continue
                    if len(row)<len(header): row += ['']*(len(header)-len(row))
                    yield {header[i]: row[i] if i<len(row) else '' for i in range(len(header))}

def nonempty(v, default='Não informado'):
    s=str(v or '').strip(); return s if s else default

def parse_num(v):
    if v is None or v=='': return 0.0
    s=str(v).strip().replace('\xa0','')
    if ',' in s and '.' in s: s=s.replace('.','').replace(',','.')
    elif ',' in s: s=s.replace(',','.')
    try: return float(s)
    except Exception: return 0.0

def pad_code(v):
    s=re.sub(r'\D','',str(v or '').strip()); return s.zfill(7) if s else ''

def norm(v):
    s=str(v or '').strip().lower()
    return ''.join(ch for ch in unicodedata.normalize('NFD',s) if unicodedata.category(ch)!='Mn')

def sim_nao(v):
    n=norm(v)
    if n in ('sim','s','yes'): return 'Sim'
    if n in ('nao','n','no'): return 'Não'
    return 'Não informado'

def sexo(v):
    n=norm(v)
    if n in ('f','fem','feminino','mulher','mulheres'): return 'Mulheres'
    if n in ('m','masc','masculino','homem','homens'): return 'Homens'
    return 'Não informado / PJ'

def parse_month(v):
    s=str(v or '').strip(); m=re.match(r'^(\d{1,2})/(\d{4})$',s)
    if m: return f'{int(m.group(2)):04d}-{int(m.group(1)):02d}'
    m=re.match(r'^(\d{4})[-/](\d{1,2})',s)
    if m: return f'{int(m.group(1)):04d}-{int(m.group(2)):02d}'
    return ''

def taxa_bin(tx):
    if tx <= 0: return 'Não informado'
    if tx < 4: return 'Até 4% a.a.'
    if tx < 6: return '4% a 6% a.a.'
    if tx < 8: return '6% a 8% a.a.'
    if tx < 10: return '8% a 10% a.a.'
    return '10% a.a. ou mais'

def load_tipologia(path):
    terr={}; counts=defaultdict(int)
    for r in iter_sheet_dicts(path,'Base de dados'):
        code=pad_code(r.get('Código de município'))
        if not code: continue
        tip=nonempty(r.get('Tipologia Amazônia Azul')); uf=nonempty(r.get('UF'))
        terr[code]={'codMun':code,'municipioTipologia':nonempty(r.get('Nome de município')),'ufTipologia':uf,'macroTipologia':UF_TO_MACRO.get(uf,nonempty(r.get('Macrorregião'))),'tipologiaTerritorial':tip}
        counts[tip]+=1
    return terr, dict(counts)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--base-bruta', required=True)
    ap.add_argument('--tipologia', required=True)
    ap.add_argument('--saida', required=True)
    ap.add_argument('--saida-tipologia', required=True)
    ap.add_argument('--fundo', required=True)
    ap.add_argument('--periodo', required=True)
    args=ap.parse_args()
    terr, terr_counts=load_tipologia(args.tipologia)
    key_fields=['fundo','uf','codMun','municipio','macro','tipologiaPndr','tipologiaTerritorial','faixaFronteira','semiarido','pfPj','anoMes','ano','mes','cnae','setor','programa','linha','atividade','porte','finalidade','risco','taxaJurosFaixa','estagio','carteira','instituicao','sexo','atividadeAzul']
    agg={}; raw=elig=no_terr=no_period=0; months=set(); muns=set(); cnaes=set()
    for r in iter_sheet_dicts(args.base_bruta,'Dados_Anexo-I'):
        raw+=1; code=pad_code(r.get('CÓDIGO DE MUNICÍPIO')); tr=terr.get(code)
        if not tr: no_terr+=1; continue
        per=parse_month(r.get('DATA DA CONTRATAÇÃO'))
        if not per: no_period+=1; continue
        uf=nonempty(r.get('UF'))
        item={'fundo':args.fundo,'uf':uf,'codMun':code,'municipio':nonempty(r.get('NOME DO MUNICÍPIO')),'macro':UF_TO_MACRO.get(uf,tr['macroTipologia']),'tipologiaPndr':nonempty(r.get('TIPOLOGIA MUNICÍPIO')),'tipologiaTerritorial':tr['tipologiaTerritorial'],'faixaFronteira':nonempty(r.get('FAIXA DE FRONTEIRA')),'semiarido':nonempty(r.get('SEMIÁRIDO')),'pfPj':nonempty(r.get('PESSOA FISICA JURÍDICA')),'anoMes':per,'ano':int(per[:4]),'mes':int(per[5:7]),'cnae':nonempty(r.get('CNAE')),'setor':nonempty(r.get('SETOR')),'programa':nonempty(r.get('PROGRAMA')),'linha':nonempty(r.get('LINHA DE FINANCIAMENTO')),'atividade':nonempty(r.get('ATIVIDADE')),'porte':nonempty(r.get('PORTE')),'finalidade':nonempty(r.get('FINALIDADE DA OPERAÇÃO')),'risco':nonempty(r.get('RISCO DA OPERAÇÃO')),'taxaJurosFaixa':taxa_bin(parse_num(r.get('TAXA DE JUROS'))),'estagio':nonempty(r.get('ESTÁGIO')),'carteira':nonempty(r.get('CARTEIRA')),'instituicao':nonempty(r.get('INSTITUIÇÃO OPERADORA')),'sexo':sexo(r.get('SEXO')),'atividadeAzul':sim_nao(r.get('TIPOLOGIA AMAZÔNIA AZUL'))}
        key=tuple(item[f] for f in key_fields)
        if key not in agg: agg[key]={**item,'valor':0.0,'beneficiarios':0.0,'contratos':0.0,'registrosAgregados':0}
        a=agg[key]; a['valor']+=parse_num(r.get('VALOR CONTRATADO')); a['beneficiarios']+=parse_num(r.get('QTDE DE BENEFICIÁRIOS')); a['contratos']+=parse_num(r.get('QUANTIDADE DE CONTRATOS')); a['registrosAgregados']+=1
        elig+=1; months.add(per); muns.add(code); cnaes.add(item['cnae'])
    schema=key_fields+['valor','beneficiarios','contratos','registrosAgregados']
    compact=[]
    for r in agg.values():
        compact.append([round(float(r[f]),2) if f=='valor' else int(round(float(r[f]))) if f in ('beneficiarios','contratos') else r[f] for f in schema])
    Path(args.saida).parent.mkdir(parents=True, exist_ok=True)
    json.dump({'schema':schema,'rows':compact,'metadata':{'versao':'agregado-v1','fonteBase':Path(args.base_bruta).name,'fundo':args.fundo,'periodoReferencia':args.periodo,'observacao':'Arquivo agregado e compactado para publicação pública. Não contém a base bruta nem registros individuais.','registrosOriginais':raw,'registrosElegiveis':elig,'registrosForaDaTipologia':no_terr,'registrosSemPeriodo':no_period,'linhasAgregadas':len(compact),'municipiosElegiveisComOperacao':len(muns),'cnaes':len(cnaes),'periodos':sorted(months),'tipologiaMunicipiosElegiveis':terr_counts}}, open(args.saida,'w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
    json.dump({'municipios':list(terr.values()),'metadata':{'fonte':Path(args.tipologia).name,'variaveis':['Código de município','Nome de município','UF','Tipologia Amazônia Azul']}}, open(args.saida_tipologia,'w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
    print(f'OK: {len(compact)} linhas agregadas escritas em {args.saida}')

if __name__=='__main__': main()
