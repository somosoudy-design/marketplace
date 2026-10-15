from pathlib import Path
import re,base64,mimetypes
base=Path(__file__).resolve().parent
def data(path):
 path=path.resolve();kind=mimetypes.guess_type(path.name)[0] or ('font/ttf' if path.suffix=='.ttf' else 'application/octet-stream')
 return 'data:'+kind+';base64,'+base64.b64encode(path.read_bytes()).decode()
css=(base/'design.css').read_text()
css=re.sub(r'url\(([^)]+)\)',lambda m:'url('+data(base/m[1].strip('\"\''))+')',css)
s=(base/'index.html').read_text().replace('<link rel="stylesheet" href="design.css">','<style>'+css+'</style>')
for src in ['../experiencia-v3/icons.js','catalog-data.js','design.js']:
 js=(base/src).read_text()
 if src=='catalog-data.js':
  js=re.sub(r'"src": "([^\"]+)"',lambda m:'"src": "'+data(base/m[1])+'"',js)
 s=s.replace('<script src="'+src+'"></script>','<script>'+js.replace('</script','<\\/script')+'</script>')
s=s.replace("default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self';", "default-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:;")
p=base.parents[1]/'.local/diseno-v4/HAYAZGO-comprar.html'
p.parent.mkdir(parents=True,exist_ok=True)
licenses='\n<!-- Third-party license notices accompany the embedded fonts and icon data.\n'+(base/'../experiencia-v3/assets/FONT-LICENSE.txt').read_text()+'\n'+(base/'../experiencia-v3/assets/ICONS-LICENSE.txt').read_text()+'\n-->\n'
p.write_text(s.replace('</body>',licenses+'</body>'))
assert '<script src=' not in s and '<link rel="stylesheet"' not in s
assert '"src": "../../apps/' not in s
print({'download':str(p),'bytes':p.stat().st_size,'allImagesAndFontsEmbedded':True,'connectSrc':'none'})
