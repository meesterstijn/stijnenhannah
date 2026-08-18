function a(n){const r=Math.max(0,Math.floor(n)),t=Math.floor(r/3600),o=Math.floor(r%3600/60);return t===0&&o===0?"<1m":t===0?`${o}m`:`${t}u ${o}m`}export{a as f};
