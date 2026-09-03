// ==============================================================================
// CEREBRO DIGITAL - MOTOR CRISTALINO & RUTA AL NÚCLEO
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyKF3KUVC9HpccVUocbaHojMN8DpY4WC1gwI-fTI98-0ykiHubBbt6GMUsC6Aa7zKWqRQ/exec';

let Graph;
const highlightNodes = new Set();
const highlightLinks = new Set();

const PALETA_NEON = ['#00f5d4', '#38bdf8', '#a855f7', '#f59e0b', '#ec4899', '#10b981'];

function armonizarColor(colorOriginal, id) {
  if (!colorOriginal || colorOriginal === '#ff0000' || colorOriginal === '#00ff00' || colorOriginal === '#0000ff') {
    let hash = 0;
    const str = String(id || 'default');
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return PALETA_NEON[Math.abs(hash) % PALETA_NEON.length];
  }
  return colorOriginal;
}

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

// ALGORITMO: Trazar cordón umbilical hacia el núcleo
function trazarRutaAlNucleo(startNode) {
  const queue = [[startNode]];
  const visited = new Set([startNode.id]);
  let shortestPath = null;
  const nodesArray = Graph.graphData().nodes;
  const linksArray = Graph.graphData().links;

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current.id === 'Omni-Eco' || (current.name && current.name.includes('Omnitron'))) {
      shortestPath = path;
      break;
    }

    if (current.neighbors) {
      for (let neighbor of current.neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push([...path, neighbor]);
        }
      }
    }
  }

  if (shortestPath) {
    shortestPath.forEach(n => highlightNodes.add(n));
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const a = shortestPath[i];
      const b = shortestPath[i + 1];
      const link = linksArray.find(l => 
        (l.source.id === a.id && l.target.id === b.id) || 
        (l.source.id === b.id && l.target.id === a.id)
      );
      if (link) highlightLinks.add(link);
    }
  }
}

function renderizarGrafo(data) {
  const geoSphere = new THREE.SphereGeometry(1, 32, 32);

  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#02040a') 
    .showNavInfo(false)

    // 1. FÍSICAS DE REPOSO: Los nodos se posicionan y luego se quedan COMPLETAMENTE ESTÁTICOS
    .cooldownTicks(250) 
    .d3AlphaDecay(0.015) 
    .d3VelocityDecay(0.2) 

    // 2. ARISTAS LÁSER RECTAS
    .linkColor(link => {
      const hayFoco = highlightNodes.size > 0;
      return highlightLinks.has(link) ? '#00f5d4' : (hayFoco ? 'rgba(15, 23, 42, 0.1)' : 'rgba(56, 189, 248, 0.25)');
    })
    .linkOpacity(0.9)
    .linkWidth(link => highlightLinks.has(link) ? 2.0 : 0.6)
    .linkDirectionalParticles(link => highlightLinks.has(link) ? 3 : 1)
    .linkDirectionalParticleSpeed(0.005)
    .linkDirectionalParticleWidth(link => highlightLinks.has(link) ? 2.5 : 1.2)
    .linkDirectionalParticleColor(() => '#ffffff')

    // 3. NODOS: CRISTALES TRASLÚCIDOS
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const baseColor = new THREE.Color(node.color);
      const size = node.val;
      const esRaiz = node.id === 'Omni-Eco' || node.name?.includes('Omnitron');

      // Material físico simulando vidrio cristalino
      const material = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.4,
        roughness: 0.1,
        metalness: 0.2,
        transmission: 0.6, 
        transparent: true,
        opacity: 0.7, // 70% sólido por defecto
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      });
      
      const mesh = new THREE.Mesh(geoSphere, material);
      mesh.scale.set(size * 0.55, size * 0.55, size * 0.55); 
      group.add(mesh);

      const sprite = new SpriteText(node.name || node.id);
      sprite.color = esRaiz ? '#ffffff' : node.color;
      sprite.textHeight = esRaiz ? 4.0 : Math.max(2.5, size * 0.35);
      sprite.position.y = size * 0.65 + 3.0;
      sprite.fontFace = "'Rajdhani', sans-serif";
      sprite.fontWeight = '700';
      sprite.strokeColor = '#02040a';
      sprite.strokeWidth = 1.5;
      group.add(sprite);

      return group;
    })
    
    // 4. INTERACCIONES Y DETENCIÓN DE ROTACIÓN
    .onNodeClick(node => {
      isOrbiting = false; // Detiene universo y cámara
      Graph.controls().autoRotate = false; 
      
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

      highlightNodes.clear(); highlightLinks.clear();
      
      // Agrega vecinos inmediatos
      highlightNodes.add(node);
      if (node.neighbors) node.neighbors.forEach(v => highlightNodes.add(v));
      if (node.links) node.links.forEach(l => highlightLinks.add(l));
      
      // Trazar línea de vida hasta Omni-Eco
      trazarRutaAlNucleo(node);
      
      actualizarFiltroVisual(); 
      const distRatio = 1 + 50 / Math.hypot(node.x, node.y, node.z);
      Graph.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);
    })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear(); highlightLinks.clear();
      actualizarFiltroVisual();
      
      isOrbiting = true; // Reactiva el universo
      Graph.controls().autoRotate = true; 
    });

  Graph.d3Force('charge').strength(-400);
  Graph.d3Force('link').distance(link => (link.source.id === 'Omni-Eco' || link.target.id === 'Omni-Eco') ? 160 : 80);

  // FONDO ESPACIAL (MÁS PROFUNDO)
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 5000;
  const posArray = new Float32Array(starsCount * 3);
  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 4000;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMat = new THREE.PointsMaterial({
    size: 1.5, color: 0x88ccff, transparent: true, opacity: 0.6, sizeAttenuation: true
  });
  const starMesh = new THREE.Points(starsGeo, starsMat);
  Graph.scene().add(starMesh);
  
  // Iluminación para los cristales
  Graph.scene().add(new THREE.AmbientLight(0xffffff, 0.5));
  const light = new THREE.DirectionalLight(0xffffff, 0.6);
  light.position.set(100, 200, 100);
  Graph.scene().add(light);

  // 5. CÁMARA LENTA Y CON INERCIA (Damping)
  const controls = Graph.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35; // Giro mucho más lento y sereno
  controls.enableDamping = true;   // Activa el deslizamiento
  controls.dampingFactor = 0.05;   // Sensibilidad del deslizamiento al soltar el ratón
  
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { 
    if (isOrbiting) setTimeout(() => { controls.autoRotate = true; }, 2000); 
  });

  // Animación del fondo (se detiene al hacer clic)
  let isOrbiting = true;
  (function animarEstrellas() {
    if (isOrbiting && starMesh) {
      starMesh.rotation.y += 0.0001; // Rotación de estrellas ultralenta
      starMesh.rotation.x += 0.00005;
    }
    requestAnimationFrame(animarEstrellas);
  })();
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  Graph.graphData().nodes.forEach(node => {
    if (node.__threeObj) {
      const enfocado = highlightNodes.has(node);
      // Estado normal = 70% (0.7). 
      // Enfocado = 30% (0.3). No enfocado (fondo) = 5% (0.05).
      const opacityVal = hayFoco ? (enfocado ? 0.3 : 0.05) : 0.7;
      node.__threeObj.children.forEach(child => {
        if (child.material) {
          child.material.opacity = opacityVal;
        }
      });
    }
  });
  Graph.linkColor(Graph.linkColor())
       .linkWidth(Graph.linkWidth())
       .linkDirectionalParticles(Graph.linkDirectionalParticles());
}

function volarHaciaNodo() {
  const texto = document.getElementById('buscador').value.toLowerCase().trim();
  if (!texto || !Graph) return;
  const target = Graph.graphData().nodes.find(n => 
    (n.id && n.id.toLowerCase().includes(texto)) || (n.name && n.name.toLowerCase().includes(texto))
  );
  if (target) {
    isOrbiting = false; 
    Graph.controls().autoRotate = false; 
    highlightNodes.clear(); highlightLinks.clear();
    
    highlightNodes.add(target);
    if (target.neighbors) target.neighbors.forEach(v => highlightNodes.add(v));
    if (target.links) target.links.forEach(l => highlightLinks.add(l));
    
    trazarRutaAlNucleo(target);
    
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
    actualizarFiltroVisual();
    
    const ratio = 1 + 50 / Math.hypot(target.x, target.y, target.z);
    Graph.cameraPosition({ x: target.x * ratio, y: target.y * ratio, z: target.z * ratio }, target, 2000);
  }
}

document.getElementById('btn-buscar').addEventListener('click', volarHaciaNodo);
document.getElementById('buscador').addEventListener('keypress', e => { 
  if (e.key === 'Enter') volarHaciaNodo(); 
});
