// ==============================================================================
// CEREBRO DIGITAL - MOTOR TOPOLÓGICO & WEBGL
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/TU_ID_DE_DESPLIEGUE_AQUI/exec';

let Graph;
let myChart = null; 
const highlightNodes = new Set();
const highlightLinks = new Set();

const PALETA_NEON = [
  '#00f5d4', '#38bdf8', '#a855f7', '#f59e0b', '#ec4899', '#10b981'
];

function armonizarColor(colorOriginal, id) {
  if (!colorOriginal || colorOriginal === '#ff0000' || colorOriginal === '#00ff00' || colorOriginal === '#0000ff') {
    let hash = 0;
    const str = String(id || 'default');
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return PALETA_NEON[Math.abs(hash) % PALETA_NEON.length];
  }
  return colorOriginal;
}

// 1. Fetch de Datos
fetch(API_URL)
  .then(res => res.json())
  .then(data => {
    document.getElementById('loading').style.display = 'none';
    prepararTopologia(data);
    renderizarGrafo(data);
  })
  .catch(err => {
    document.getElementById('loading').innerText = 'ERROR DE CONEXIÓN: ' + err.message;
  });

// 2. Preprocesamiento D3 y Conexiones
function prepararTopologia(data) {
  const counts = {};
  data.links.forEach(link => {
    const a = data.nodes.find(n => n.id === link.source);
    const b = data.nodes.find(n => n.id === link.target);
    if (a && b) {
      if (!a.neighbors) a.neighbors = [];
      if (!b.neighbors) b.neighbors = [];
      a.neighbors.push(b);
      b.neighbors.push(a);

      if (!a.links) a.links = [];
      if (!b.links) b.links = [];
      a.links.push(link);
      b.links.push(link);

      counts[link.source] = (counts[link.source] || 0) + 1;
      counts[link.target] = (counts[link.target] || 0) + 1;
    }
  });

  const maxConex = d3.max(Object.values(counts)) || 10;
  const scaleRadius = d3.scaleLinear().domain([1, maxConex]).range([6, 18]);

  data.nodes.forEach(n => {
    n.degree = counts[n.id] || 1;
    n.color = armonizarColor(n.color, n.id);
    n.val = (n.id === 'Omni-Eco' || n.name?.includes('Omnitron')) ? 22 : scaleRadius(n.degree);
  });
}

// 3. Renderizado 3D
function renderizarGrafo(data) {
  const geoSphere = new THREE.SphereGeometry(1, 28, 28);
  const geoHalo = new THREE.SphereGeometry(1, 20, 20);

  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#030712')
    .showNavInfo(false)
    .linkCurvature(0.18)
    .linkCurveRotation(0.25)
    .linkColor(link => {
      const hayFoco = highlightNodes.size > 0;
      return highlightLinks.has(link) ? '#00f5d4' : (hayFoco ? 'rgba(15, 23, 42, 0.2)' : 'rgba(56, 189, 248, 0.25)');
    })
    .linkOpacity(0.8)
    .linkWidth(link => highlightLinks.has(link) ? 2.0 : 1.0)
    .linkDirectionalParticles(link => highlightLinks.has(link) ? 4 : 1)
    .linkDirectionalParticleSpeed(0.004)
    .linkDirectionalParticleWidth(link => highlightLinks.has(link) ? 2.2 : 1.2)
    .linkDirectionalParticleColor(() => '#ffffff')
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const baseColor = new THREE.Color(node.color);
      const size = node.val;
      const esRaiz = node.id === 'Omni-Eco' || node.name?.includes('Omnitron');

      const matSphere = new THREE.MeshLambertMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.95
      });
      const meshSphere = new THREE.Mesh(geoSphere, matSphere);
      meshSphere.scale.set(size * 0.45, size * 0.45, size * 0.45);
      group.add(meshSphere);

      const matHalo = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: esRaiz ? 0.35 : 0.18,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
      });
      const meshHalo = new THREE.Mesh(geoHalo, matHalo);
      meshHalo.scale.set(size * 0.9, size * 0.9, size * 0.9);
      group.add(meshHalo);

      const sprite = new SpriteText(node.name || node.id);
      sprite.color = esRaiz ? '#ffffff' : node.color;
      sprite.textHeight = esRaiz ? 3.8 : Math.max(2.2, size * 0.3);
      sprite.position.y = size * 0.7 + 3.0;
      sprite.fontFace = "'Rajdhani', sans-serif";
      sprite.fontWeight = '700';
      sprite.strokeColor = '#030712';
      sprite.strokeWidth = 1.2;
      group.add(sprite);

      return group;
    })
    .onNodeClick(node => {
      document.getElementById('card-title').innerText = node.name;
      document.getElementById('card-id').innerText = node.id;
      document.getElementById('card-desc').innerText = node.axioma || node.ordinario || 'Axioma de base ontológica';
      
      const btnDoc = document.getElementById('btn-doc');
      if (node.url && node.url.includes('http')) {
        btnDoc.href = node.url;
        btnDoc.style.display = 'inline-block';
      } else {
        btnDoc.style.display = 'none';
      }
      
      document.getElementById('info-card').style.display = 'block';
      generarRadarECharts(node);

      highlightNodes.clear();
      highlightLinks.clear();
      highlightNodes.add(node);
      if (node.neighbors) node.neighbors.forEach(v => highlightNodes.add(v));
      if (node.links) node.links.forEach(l => highlightLinks.add(l));
      
      actualizarFiltroVisual(); 
      const distRatio = 1 + 45 / Math.hypot(node.x, node.y, node.z);
      Graph.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);
    })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear();
      highlightLinks.clear();
      actualizarFiltroVisual();
    });

  Graph.d3Force('charge').strength(-380);
  Graph.d3Force('link').distance(link => (link.source.id === 'Omni-Eco' || link.target.id === 'Omni-Eco') ? 170 : 80);

  const controls = Graph.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  Graph.graphData().nodes.forEach(node => {
    if (node.__threeObj) {
      const enfocado = highlightNodes.has(node);
      const opacityVal = hayFoco ? (enfocado ? 1.0 : 0.08) : 0.95;
      node.__threeObj.children.forEach(child => {
        if (child.material) child.material.opacity = opacityVal;
      });
    }
  });
  Graph.linkColor(Graph.linkColor())
       .linkWidth(Graph.linkWidth())
       .linkDirectionalParticles(Graph.linkDirectionalParticles());
}

function generarRadarECharts(node) {
  if (!myChart) {
    myChart = echarts.init(document.getElementById('echarts-radar'));
    window.addEventListener('resize', () => myChart.resize());
  }

  const conex = node.degree || 1;
  const option = {
    radar: {
      indicator: [
        { name: 'Red', max: 15 },
        { name: 'Centralidad', max: 10 },
        { name: 'Profundidad', max: 25 },
        { name: 'Axiomas', max: 10 }
      ],
      splitArea: { show: false },
      axisLine: { lineStyle: { color: 'rgba(56, 189, 248, 0.25)' } },
      splitLine: { lineStyle: { color: 'rgba(56, 189, 248, 0.12)' } },
      axisName: { color: '#94a3b8', fontSize: 9, fontFamily: 'Rajdhani' }
    },
    series: [{
      type: 'radar',
      data: [{
        value: [conex, Math.min(conex * 1.3, 10), node.val || 10, Math.min(conex, 7)],
        name: node.id,
        areaStyle: { color: 'rgba(0, 245, 212, 0.2)' },
        lineStyle: { color: '#00f5d4', width: 1.5 },
        itemStyle: { color: '#38bdf8' }
      }]
    }]
  };
  myChart.setOption(option);
}

function volarHaciaNodo() {
  const texto = document.getElementById('buscador').value.toLowerCase().trim();
  if (!texto || !Graph) return;
  
  const target = Graph.graphData().nodes.find(n => 
    (n.id && n.id.toLowerCase().includes(texto)) || 
    (n.name && n.name.toLowerCase().includes(texto))
  );
  
  if (target) {
    highlightNodes.clear();
    highlightLinks.clear();
    highlightNodes.add(target);
    if (target.neighbors) target.neighbors.forEach(v => highlightNodes.add(v));
    if (target.links) target.links.forEach(l => highlightLinks.add(l));
    
    document.getElementById('card-title').innerText = target.name;
    document.getElementById('card-id').innerText = target.id;
    document.getElementById('card-desc').innerText = target.axioma || target.ordinario || 'Axioma base';
    
    const btnDoc = document.getElementById('btn-doc');
    if (target.url && target.url.includes('http')) {
      btnDoc.href = target.url; 
      btnDoc.style.display = 'inline-block';
    } else {
      btnDoc.style.display = 'none';
    }
    
    document.getElementById('info-card').style.display = 'block';
    generarRadarECharts(target);
    actualizarFiltroVisual();
    
    const ratio = 1 + 45 / Math.hypot(target.x, target.y, target.z);
    Graph.cameraPosition({ x: target.x * ratio, y: target.y * ratio, z: target.z * ratio }, target, 2000);
  }
}

document.getElementById('btn-buscar').addEventListener('click', volarHaciaNodo);
document.getElementById('buscador').addEventListener('keypress', e => { 
  if (e.key === 'Enter') volarHaciaNodo(); 
});
