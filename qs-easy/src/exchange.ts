// The workbook contains one tabular worksheet. Text cells stay literal in Excel.
const enc=new TextEncoder(), dec=new TextDecoder()
function crc32(bytes:Uint8Array){let crc=-1;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^-1)>>>0}
function header(size:number,signature:number){const bytes=new Uint8Array(size);const view=new DataView(bytes.buffer);view.setUint32(0,signature,true);return {bytes,view}}
function zip(files:Record<string,string>){
  const parts:BlobPart[]=[],directory:BlobPart[]=[]
  let offset=0,centralSize=0
  for(const [path,xml] of Object.entries(files)){
    const name=enc.encode(path), data=enc.encode(xml), crc=crc32(data)
    const local=header(30,0x04034b50),entry=header(46,0x02014b50)
    local.view.setUint16(4,20,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,data.length,true);local.view.setUint32(22,data.length,true);local.view.setUint16(26,name.length,true)
    entry.view.setUint16(4,20,true);entry.view.setUint16(6,20,true);entry.view.setUint32(16,crc,true);entry.view.setUint32(20,data.length,true);entry.view.setUint32(24,data.length,true);entry.view.setUint16(28,name.length,true);entry.view.setUint32(42,offset,true)
    parts.push(local.bytes,name,data);directory.push(entry.bytes,name);offset+=30+name.length+data.length;centralSize+=46+name.length
  }
  const end=header(22,0x06054b50),count=Object.keys(files).length
  end.view.setUint16(8,count,true);end.view.setUint16(10,count,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true)
  return new Blob([...parts,...directory,end.bytes])
}
const xmlEscape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
export function workbook(rows:(string|number)[][]){
  const ns='http://schemas.openxmlformats.org/', sheet=ns+'spreadsheetml/2006/main',rel=ns+'officeDocument/2006/relationships'
  const relationships=(type:string,target:string)=>'<Relationships xmlns="'+ns+'package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/'+type+'" Target="'+target+'"/></Relationships>'
  return zip({
    '[Content_Types].xml':'<Types xmlns="'+ns+'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':relationships('officeDocument','xl/workbook.xml'),
    'xl/workbook.xml':'<workbook xmlns="'+sheet+'" xmlns:r="'+rel+'"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':relationships('worksheet','worksheets/sheet1.xml'),
    'xl/worksheets/sheet1.xml':'<worksheet xmlns="'+sheet+'"><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{const ref=String.fromCharCode(65+j)+(i+1);return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>'
  })
}
async function sheetRows(file:File){
  const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer),v=new DataView(buffer)
  let end=bytes.length-22
  while(end>=0 && v.getUint32(end,true)!==0x06054b50)end--
  if(end<0)throw Error('Invalid Excel workbook.')
  const contents=new Map<string,string>();let offset=v.getUint32(end+16,true),size=0
  for(let i=0;i<v.getUint16(end+10,true);i++){
    if(v.getUint32(offset,true)!==0x02014b50)throw Error('Invalid workbook directory.')
    const length=v.getUint16(offset+28,true),name=dec.decode(bytes.subarray(offset+46,offset+46+length))
    const method=v.getUint16(offset+10,true),packed=v.getUint32(offset+20,true),raw=v.getUint32(offset+24,true),local=v.getUint32(offset+42,true)
    offset+=46+length+v.getUint16(offset+30,true)+v.getUint16(offset+32,true)
    if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet1\.xml)$/.test(name))continue
    size+=raw;if(size>16_000_000)throw Error('Workbook is too large.')
    const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true)
    const blob=new Blob([bytes.slice(start,start+packed)])
    if(method!==0 && method!==8) throw Error('Unsupported workbook compression.')
    const stream=method===0?blob.stream():blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const reader=stream.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let read=0
    while(true){const part=await reader.read();if(part.done)break;read+=part.value.length;if(read>raw){await reader.cancel();throw Error('Invalid worksheet size.')}chunks.push(new Uint8Array(part.value))}
    contents.set(name,await new Blob(chunks).text())
  }
  const xml=(path:string)=>new DOMParser().parseFromString(contents.get(path)||'<empty/>','application/xml')
  const shared=[...xml('xl/sharedStrings.xml').getElementsByTagName('si')].map(i=>i.textContent||'')
  return [...xml('xl/worksheets/sheet1.xml').getElementsByTagName('row')].map(row=>{
    const values:string[]=[]
    for(const cell of row.getElementsByTagName('c')){
      const ref=cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0]||'A'
      const col=[...ref].reduce((sum,c)=>sum*26+c.charCodeAt(0)-64,0)-1
      if(col>64)continue
      const value=cell.getElementsByTagName('v')[0]?.textContent||''
      values[col]=cell.getAttribute('t')==='s'?(shared[+value]||''):cell.getAttribute('t')==='inlineStr'?(cell.textContent||''):value
    }return values
  })
}
export async function readRows(file:File){
  if(file.size>8_000_000)throw Error('Choose a file smaller than 8 MB.')
  if(file.name.toLowerCase().endsWith('.xlsx'))return sheetRows(file)
  const input=(await file.text()).replace(/^\uFEFF/,'');const rows:string[][]=[]
  let row:string[]=[],cell='',quoted=false
  for(let i=0;i<input.length;i++){const c=input[i]
    if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(c===','&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=c
  }
  if(quoted)throw Error('Unclosed CSV quotation mark.')
  row.push(cell);rows.push(row);return rows.filter(r=>r.some(c=>c.trim()))
}
export function csv(rows:(string|number)[][]){return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value);if(typeof value==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
