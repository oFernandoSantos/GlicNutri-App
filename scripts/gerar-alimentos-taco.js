const fs = require('fs');
const path = require('path');

const rawPath = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-flima-OneDrive-rea-de-Trabalho-GlicNutri-App-GlicNutri/agent-tools/ba78b022-aced-4a27-be86-82302cc3480a.txt'
);

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

function num(value) {
  if (value === null || value === undefined || value === '' || value === 'NA' || value === 'Tr') {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : 0;
}

const items = raw
  .map((row) => ({
    id: row.id,
    nome: String(row.description || '').trim(),
    categoria: String(row.category || 'Outros').trim(),
    quantidade_gramas: 100,
    porcao: '100 g',
    calorias: Math.round(num(row.energy_kcal)),
    carboidratos: num(row.carbohydrate_g),
    proteinas: num(row.protein_g),
    gorduras: num(row.lipid_g),
  }))
  .filter((item) => item.nome);

const outPath = path.join(__dirname, '..', 'src', 'dados', 'alimentosBrasilTaco.json');
fs.writeFileSync(outPath, JSON.stringify(items));

console.log(`Gerado ${items.length} alimentos em ${outPath} (${fs.statSync(outPath).size} bytes)`);
