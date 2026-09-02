#!/usr/bin/env python3
"""input_inventory.py, D38 pass 1. Every input control in the app, by view.

Counts <input>, <textarea>, <select>, <datalist> and contenteditable across
LingCoT.html and source/modules/*.js, and attributes each to the function that
emits it. Markup after the last </script> is static page furniture, not a view,
and is reported separately.

Attribution is by declaration order, so a control emitted from an arrow-function
const is credited to the preceding `function`. Six of the participants.js rows
are affected; they are corrected by hand in INPUT_UX_AUDIT.md.

Run:  python3 dev/tools/input_inventory.py
"""
import re, io, json, collections, os
# Repo-relative, so this runs on a clone as well as on the machine it was written on.
root=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
files={'LingCoT.html': root+'/source/LingCoT.html'}
import glob
for f in sorted(glob.glob(root+'/source/modules/*.js')):
    files[os.path.basename(f)]=f

rows=[]
for fname,path in files.items():
    src=io.open(path,encoding='utf-8').read()
    # script boundary for the html file: markup after </script> is static
    script_end=None
    if fname.endswith('.html'):
        # last </script> that closes the big inline script
        m=list(re.finditer(r'</script>', src))
        script_end=m[-1].start() if m else None
    fn_at=[(m.start(), m.group(1)) for m in re.finditer(r'^function ([A-Za-z_$][\w$]*)\s*\(', src, re.M)]
    fn_at+= [(m.start(), m.group(1)) for m in re.finditer(r'^\s{2}function ([A-Za-z_$][\w$]*)\s*\(', src, re.M)]
    fn_at.sort()
    def owner(pos):
        if script_end is not None and pos>script_end: return '(static markup)'
        best='(module top level)' if fname.endswith('.js') else '(top level)'
        for s,n in fn_at:
            if s<=pos: best=n
            else: break
        return best
    def add(kind,pos,snip):
        g=lambda a: (re.search(r'\b'+a+r'="([^"]*)"', snip) or [None,''])[1]
        rows.append(dict(file=fname,kind=kind,owner=owner(pos),
            id=g('id'),cls=g('class'),type=g('type'),
            ac=g('data-ac-pool') or g('data-ac-mode'),
            action=g('data-action'),
            line=src.count('\n',0,pos)+1))
    for pat,kind in [(r'<input\b[^>]*>','input'),(r'<textarea\b[^>]*>','textarea'),
                     (r'<select\b[^>]*>','select'),(r'<datalist\b[^>]*>','datalist')]:
        for m in re.finditer(pat,src): add(kind,m.start(),m.group(0))
    for m in re.finditer(r'contenteditable',src): add('contenteditable',m.start(),src[max(0,m.start()-300):m.start()+60])

print('TOTAL',len(rows))
print(collections.Counter(r['kind'] for r in rows))
print('\ninput types:',collections.Counter(r['type'] for r in rows if r['kind']=='input'))
print('\nBY FILE:',collections.Counter(r['file'] for r in rows))
print('\nBY OWNER')
for o,c in collections.Counter(r['owner'] for r in rows).most_common(80): print(f'{c:4d}  {o}')
io.open(os.path.join(root,'dev','tools','input_inventory.json'),'w').write(json.dumps(rows,indent=1))
