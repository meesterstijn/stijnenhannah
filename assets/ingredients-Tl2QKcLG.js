function m(n){return n.filter(t=>t.name.trim()).map(t=>t.amount.trim()?`${t.amount.trim()}	${t.name.trim()}`:t.name.trim()).join(`
`)}function a(n){return n.split(`
`).map(t=>t.trim()).filter(Boolean).map(t=>{const e=t.replace(/^[-•*●▪◦]\s*/,""),i=e.indexOf("	");if(i!==-1)return{amount:e.slice(0,i).trim(),name:e.slice(i+1).trim()};const r=e.match(/^([0-9][^\s]*\s+|[0-9]+\s+)?(.+)$/);return r&&r[1]?{amount:r[1].trim(),name:r[2].trim()}:{amount:"",name:e}})}function s(n){const t=n.indexOf("	");return t!==-1?`${n.slice(0,t)} ${n.slice(t+1)}`:n}export{m as a,s as i,a as t};
