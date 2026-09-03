// ==============================================================================
// CEREBRO DIGITAL - MOTOR TOPOLÓGICO & WEBGL (VERSIÓN CINEMÁTICA)
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyKF3KUVC9HpccVUocbaHojMN8DpY4WC1gwI-fTI98-0ykiHubBbt6GMUsC6Aa7zKWqRQ/exec';

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

// 2. Preprocesamiento
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
    n.val = (n.id === 'Omni-Eco' || n.name?.includes('Omnitron')) ? 24 : scaleRadius(n.degree);
  });
}

// 3. Renderizado 3D
function renderizarGrafo(data) {
  const geoSphere = new THREE.SphereGeometry(1, 32, 32); // Mayor poligonaje para suavidad

  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#02040a') // Fondo aún más profundo para contrastar las estrellas
    .showNavInfo(false)

    // --- FÍSICAS MÁS LIBRES Y FLUIDAS ---
    .cooldownTicks(Infinity)
    .d3AlphaDecay(0.005) // Evita que se congelen
    .d3VelocityDecay(0.12) // Deslizamiento mucho más suave (menos fricción)

    // --- ARISTAS RECTAS (Láseres) ---
    .linkColor(link => {
      const hayFoco = highlightNodes.size > 0;
      return highlightLinks.has(link) ? '#00f5d4' : (hayFoco ? 'rgba(15, 23, 42, 0.1)' : 'rgba(56, 189, 248, 0.25)');
    })
    .linkOpacity(0.8)
    .linkWidth(link => highlightLinks.has(link) ? 1.5 : 0.5) // Aristas finas y elegantes
    .linkDirectionalParticles(link => highlightLinks.has(link) ? 4 : 1)
    .linkDirectionalParticleSpeed(0.005)
    .linkDirectionalParticleWidth(link => highlightLinks.has(link) ? 2.5 : 1.2)
    .linkDirectionalParticleColor(() => '#ffffff')

    // --- NODOS: UN SOLO NÚCLEO EMISIVO ---
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const baseColor = new THREE.Color(node.color);
      const size = node.val;
      const esRaiz = node.id === 'Omni-Eco' || node.name?.includes('Omnitron');

      // Un solo material de alta calidad
      const matSphere = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.5,
        transparent: true,
        opacity: 0.95
      });
      const meshSphere = new THREE.Mesh(geoSphere, matSphere);
      meshSphere.scale.set(size * 0.5, size * 0.5, size * 0.5); // Escala unificada
      group.add(meshSphere);

      // Texto limpio
      const sprite = new SpriteText(node.name || node.id);
      sprite.color = esRaiz ? '#ffffff' : node.color;
      sprite.textHeight = esRaiz ? 3.8 : Math.max(2.2, size * 0.3);
      sprite.position.y = size * 0.6 + 3.0;
      sprite.fontFace = "'Rajdhani', sans-serif";
      sprite.fontWeight = '700';
      sprite.strokeColor = '#02040a';
      sprite.strokeWidth = 1.5;
      group.add(sprite);

      return group;
    })

    // --- INTERACCIONES Y ENFOQUE ---
    .onNodeClick(node => {
      isOrbiting = false; // Detiene la órbita automática para dejarte observar
      
      document.getElementById('card-title').innerText = node.name;
      document.getElementById('card-id').innerText = node.id;
      document.getElementById('card-desc').innerText = node.axioma || node.ordinario || 'Axioma base';
      
      const btnDoc = document.getElementById('btn-doc');
      if (node.url && node.url.includes('http')) {
        btnDoc.href = node.url; btnDoc.style.display = 'inline-block';
      } else {
        btnDoc.style.display = 'none';
      }
      
      document.getElementById('info-card').style.display = 'block';
      generarRadarECharts(node);

      highlightNodes.clear(); highlightLinks.clear();
      highlightNodes.add(node);
      if (node.neighbors) node.neighbors.forEach(v => highlightNodes.add(v));
      if (node.links) node.links.forEach(l => highlightLinks.add(l));
      
      actualizarFiltroVisual(); 
      const distRatio = 1 + 50 / Math.hypot(node.x, node.y, node.z);
      Graph.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);
    })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear(); highlightLinks.clear();
      actualizarFiltroVisual();
      isOrbiting = true; // Reactiva la órbita panorámica
    });

  // Repulsión fuerte para evitar amontonamientos
  Graph.d3Force('charge').strength(-400);
  Graph.d3Force('link').distance(link => (link.source.id === 'Omni-Eco' || link.target.id === 'Omni-Eco') ? 180 : 90);

  // --- CREACIÓN DEL FONDO ESTELAR (Micropartículas 3D) ---
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 4000;
  const posArray = new Float32Array(starsCount * 3);
  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 3500; // Distribución en un volumen inmenso
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMat = new THREE.PointsMaterial({
    size: 1.5,
    color: 0x66aaff,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true
  });
  const starMesh = new THREE.Points(starsGeo, starsMat);
  Graph.scene().add(starMesh); // Agregamos las estrellas al escenario

  // --- BUCLE DE ANIMACIÓN CINEMÁTICA (Órbita + Deriva) ---
  let isOrbiting = true;
  let orbitAngle = 0;
  let t = 0;
  
  // Pausar órbita si el usuario arrastra la pantalla manualmente
  Graph.controls().addEventListener('start', () => { isOrbiting = false; });

  (function animarFrame() {
    t += 0.012;
    
    // 1. Deriva suave (los nodos respiran en su sitio)
    data.nodes.forEach((node, idx) => {
      if (node.id !== 'Omni-Eco') {
        node.vx += Math.sin(t + idx) * 0.07;
        node.vy += Math.cos(t + idx * 0.8) * 0.07;
        node.vz += Math.sin(t * 0.6 + idx) * 0.07;
      }
    });

    // 2. Órbita de cámara automática y efecto parallax de estrellas
    if (isOrbiting) {
      orbitAngle += 0.0015;
      const distance = 550;
      Graph.cameraPosition({
        x: distance * Math.sin(orbitAngle),
        z: distance * Math.cos(orbitAngle)
      });
      // Rotación sutil del universo de fondo
      if (starMesh) {
        starMesh.rotation.y += 0.0003;
        starMesh.rotation.x += 0.0001;
      }
    }
    requestAnimationFrame(animarFrame);
  })();
}

// 4. Lógica de UI
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
        { name: 'Red', max: 15 }, { name: 'Central', max: 10 },
        { name: 'Relevancia', max: 25 }, { name: 'Axiomas', max: 10 }
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
    (n.id && n.id.toLowerCase().includes(texto)) || (n.name && n.name.toLowerCase().includes(texto))
  );
  if (target) {
    // Apagamos órbita y enfocamos
    isOrbiting = false; 
    highlightNodes.clear(); highlightLinks.clear();
    highlightNodes.add(target);
    if (target.neighbors) target.neighbors.forEach(v => highlightNodes.add(v));
    if (target.links) target.links.forEach(l => highlightLinks.add(l));
    
    document.getElementById('card-title').innerText = target.name;
    document.getElementById('card-id').innerText = target.id;
    document.getElementById('card-desc').innerText = target.axioma || target.ordinario || 'Axioma base';
    
    const btnDoc = document.getElementById('btn-doc');
    if (target.url && target.url.includes('http')) {
      btnDoc.href = target.url; btnDoc.style.display = 'inline-block';
    } else {
      btnDoc.style.display = 'none';
    }
    document.getElementById('info-card').style.display = 'block';
    generarRadarECharts(target);
    actualizarFiltroVisual();
    
    const ratio = 1 + 50 / Math.hypot(target.x, target.y, target.z);
    Graph.cameraPosition({ x: target.x * ratio, y: target.y * ratio, z: target.z * ratio }, target, 2000);
  }
}

document.getElementById('btn-buscar').addEventListener('click', volarHaciaNodo);
document.getElementById('buscador').addEventListener('keypress', e => { 
  if (e.key === 'Enter') volarHaciaNodo(); 
});
