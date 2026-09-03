// ==============================================================================
// CEREBRO DIGITAL - GEOMETRÍA NATIVA VASTURIANO & NEÓN PURO
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyKF3KUVC9HpccVUocbaHojMN8DpY4WC1gwI-fTI98-0ykiHubBbt6GMUsC6Aa7zKWqRQ/exec';

let Graph;
const highlightNodes = new Set();
const highlightLinks = new Set();

// Colores puros y saturados para que el Bloom los detecte como luz real
const PALETA_NEON = ['#00f5d4', '#00ffff', '#b100ff', '#ff0055', '#ffea00', '#00ff66'];

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
  const scaleRadius = d3.scaleLinear().domain([1, maxConex]).range([3, 9]); 

  data.nodes.forEach(n => {
    n.degree = counts[n.id] || 1;
    n.color = armonizarColor(n.color, n.id);
    n.val = (n.id === 'Omni-Eco' || n.name?.includes('Omnitron')) ? 14 : scaleRadius(n.degree);
  });
}

function trazarRutaAlNucleo(startNode) {
  const queue = [[startNode]];
  const visited = new Set([startNode.id]);
  let shortestPath = null;
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
        (l.source.id === a.id && l.target.id === b.id) || (l.source.id === b.id && l.target.id === a.id)
      );
      if (link) highlightLinks.add(link);
    }
  }
}

function renderizarGrafo(data) {
  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#040509') // Fondo espacial oscuro y profundo
    .showNavInfo(false)

    // FÍSICAS DE ESTABILIZACIÓN NATIVA
    .cooldownTicks(200)
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    
    // 2. ARISTAS RECTAS Y ESTÉTICAS (Azul Neón)
    .linkColor(link => {
      const hayFoco = highlightNodes.size > 0;
      // Si está enfocado brilla blanco, si no hay foco es azul neón, si está apagado casi ni se ve
      return highlightLinks.has(link) ? '#ffffff' : (hayFoco ? 'rgba(0, 210, 255, 0.05)' : '#00d2ff');
    })
    .linkOpacity(link => highlightLinks.has(link) ? 0.9 : 0.35) 
    .linkWidth(link => highlightLinks.has(link) ? 2.0 : 0.6)
    .linkDirectionalParticles(link => highlightLinks.has(link) ? 4 : 0) 
    .linkDirectionalParticleSpeed(0.008)
    .linkDirectionalParticleWidth(2.5)
    .linkDirectionalParticleColor(() => '#ffffff')

    // GEOMETRÍA NATIVA VASTURIANO: Esferas simples para maximizar el neón
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const esRaiz = node.id === 'Omni-Eco' || node.name?.includes('Omnitron');

      // MeshBasicMaterial ignora sombras y luces, emitiendo color puro para el Bloom
      const geometry = new THREE.SphereGeometry(node.val * 0.8, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: node.color,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      // Tipografía limpia y brillante
      const sprite = new SpriteText(node.name || node.id);
      sprite.color = '#ffffff'; 
      sprite.textHeight = esRaiz ? 3.5 : Math.max(1.8, node.val * 0.35);
      sprite.position.y = (node.val * 0.8) + 2.5;
      sprite.fontFace = "'Rajdhani', sans-serif";
      sprite.fontWeight = '700';
      group.add(sprite);

      return group;
    })

    // EVENTOS (Congelamiento de cámara al enfocar)
    .onNodeClick(node => {
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
      highlightNodes.add(node);
      if (node.neighbors) node.neighbors.forEach(v => highlightNodes.add(v));
      
      trazarRutaAlNucleo(node);
      actualizarFiltroVisual(); 
      
      const distRatio = 1 + 55 / Math.hypot(node.x, node.y, node.z);
      Graph.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
    })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear(); highlightLinks.clear();
      actualizarFiltroVisual();
      
      setTimeout(() => { Graph.controls().autoRotate = true; }, 800);
    });

  Graph.d3Force('charge').strength(-180); 
  Graph.d3Force('link').distance(link => (link.source.id === 'Omni-Eco' || link.target.id === 'Omni-Eco') ? 80 : 35);

// MICRO-ESTRELLAS ILUMINADAS
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 2000;
  const posArray = new Float32Array(starsCount * 3);
  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 3000;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMat = new THREE.PointsMaterial({
    size: 2.2,             // Aumentamos el tamaño sutilmente
    color: 0x88ffff,       // Cian brillante casi blanco
    transparent: true, 
    opacity: 0.9,          // Subimos la opacidad para que el Bloom las haga brillar
    sizeAttenuation: true
  });
  const starMesh = new THREE.Points(starsGeo, starsMat);
  Graph.scene().add(starMesh);

 // EFECTO NEÓN NATIVO (UnrealBloomPass Ajustado)
  const bloomPass = new THREE.UnrealBloomPass();
  bloomPass.strength = 0.25;  // Brillo mucho más suave y controlado
  bloomPass.radius = 0.15;    // El resplandor se queda pegado al nodo, no mancha la pantalla
  bloomPass.threshold = 0.2;  // CLAVE: Solo brillan los colores puros, eliminando la "niebla"
  Graph.postProcessingComposer().addPass(bloomPass);

  // CÁMARA (Órbita majestuosa con Damping)
  const controls = Graph.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3; 
  controls.enableDamping = true;  
  controls.dampingFactor = 0.08;  
  
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { 
    if (highlightNodes.size === 0) setTimeout(() => { controls.autoRotate = true; }, 2000); 
  });

  // Rotación ultra lenta del universo de fondo
  (function animarEstrellas() {
    if (starMesh && Graph.controls().autoRotate) {
      starMesh.rotation.y += 0.00015;
    }
    requestAnimationFrame(animarEstrellas);
  })();
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  Graph.graphData().nodes.forEach(node => {
    if (node.__threeObj) {
      const enfocado = highlightNodes.has(node);
      const opacidadCristal = hayFoco ? (enfocado ? 1.0 : 0.05) : 1.0;
      const opacidadTexto = hayFoco ? (enfocado ? 1.0 : 0.03) : 1.0;

      const group = node.__threeObj.children;
      if (group[0] && group[0].material) group[0].material.opacity = opacidadCristal;
      if (group[1]) group[1].material.opacity = opacidadTexto;
    }
  });
  
  Graph.linkColor(Graph.linkColor())
       .linkOpacity(Graph.linkOpacity())
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
    Graph.controls().autoRotate = false; 
    highlightNodes.clear(); highlightLinks.clear();
    
    highlightNodes.add(target);
    if (target.neighbors) target.neighbors.forEach(v => highlightNodes.add(v));
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
    
    const ratio = 1 + 60 / Math.hypot(target.x, target.y, target.z);
    Graph.cameraPosition({ x: target.x * ratio, y: target.y * ratio, z: target.z * ratio }, target, 1500);
  }
}

document.getElementById('btn-buscar').addEventListener('click', volarHaciaNodo);
document.getElementById('buscador').addEventListener('keypress', e => { 
  if (e.key === 'Enter') volarHaciaNodo(); 
});
