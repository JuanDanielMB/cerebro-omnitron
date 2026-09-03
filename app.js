// ==============================================================================
// CEREBRO DIGITAL - NEÓN CIBERPUNK & RUTA AL NÚCLEO
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyKF3KUVC9HpccVUocbaHojMN8DpY4WC1gwI-fTI98-0ykiHubBbt6GMUsC6Aa7zKWqRQ/exec';

let Graph;
const highlightNodes = new Set();
const highlightLinks = new Set();

// Paleta Neón Ciberpunk (Colores ultrapuros)
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

  // Nodos más pequeños en general para el efecto de red densa
  const maxConex = d3.max(Object.values(counts)) || 10;
  const scaleRadius = d3.scaleLinear().domain([1, maxConex]).range([3, 10]); 

  data.nodes.forEach(n => {
    n.degree = counts[n.id] || 1;
    n.color = armonizarColor(n.color, n.id);
    n.val = (n.id === 'Omni-Eco' || n.name?.includes('Omnitron')) ? 16 : scaleRadius(n.degree);
  });
}

// CORDÓN UMBILICAL (BFS): Ilumina desde el nodo clicado hasta el centro
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
  const geoSphere = new THREE.SphereGeometry(1, 32, 32);

  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#010205') // Fondo Ciberpunk abismal
    .showNavInfo(false)

    // 1. FÍSICAS RÁPIDAS Y ESTÁTICAS: Se arma la red y se congela
    .cooldownTicks(150) // Tiempo corto de acomodación
    .d3VelocityDecay(0.4) // Fricción alta para que se queden quietos
    
    // 2. RED COMPACTA Y DENSA (Aristas cortas)
    .linkColor(link => {
      const hayFoco = highlightNodes.size > 0;
      return highlightLinks.has(link) ? '#ffffff' : (hayFoco ? 'rgba(0, 255, 255, 0.05)' : link.source.color);
    })
    .linkOpacity(1)
    .linkWidth(link => highlightLinks.has(link) ? 3.0 : 0.8) // Líneas láser
    .linkDirectionalParticles(link => highlightLinks.has(link) ? 4 : 0) // Partículas solo en la ruta iluminada
    .linkDirectionalParticleSpeed(0.008)
    .linkDirectionalParticleWidth(3)
    .linkDirectionalParticleColor(() => '#ffffff')

    // 3. NODOS: CRISTALES NEÓN
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const baseColor = new THREE.Color(node.color);
      const size = node.val;
      const esRaiz = node.id === 'Omni-Eco' || node.name?.includes('Omnitron');

      // A) CRISTAL INTERNO (Material Avanzado)
      const material = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 1.5, // Brillo propio alto
        roughness: 0.1,
        transmission: 0.9, // Efecto vidrio
        thickness: 1.5,
        transparent: true,
        opacity: 0.7 // 70% sólido inicial
      });
      const mesh = new THREE.Mesh(geoSphere, material);
      mesh.scale.set(size * 0.6, size * 0.6, size * 0.6);
      group.add(mesh);

      // B) HALO DE NEÓN (Brillo difuminado exterior)
      const haloMat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.2, // Resplandor sutil
        blending: THREE.AdditiveBlending, // Mezcla de luz pura
        depthWrite: false
      });
      const halo = new THREE.Mesh(geoSphere, haloMat);
      halo.scale.set(size * 0.8, size * 0.8, size * 0.8);
      group.add(halo);

      // C) TIPOGRAFÍA CIBERPUNK VIVA
      const sprite = new SpriteText(node.name || node.id);
      sprite.color = '#ffffff'; // Letras súper blancas
      sprite.textHeight = esRaiz ? 3.5 : Math.max(1.8, size * 0.3);
      sprite.position.y = size * 0.7 + 2.0;
      sprite.fontFace = "'Orbitron', sans-serif";
      sprite.fontWeight = '800';
      // Borde del color del nodo para dar efecto neón al texto
      sprite.strokeColor = node.color;
      sprite.strokeWidth = 1.0; 
      group.add(sprite);

      return group;
    })

    // 4. EVENTOS Y CONTROL DE CÁMARA
    .onNodeClick(node => {
      const controls = Graph.controls();
      controls.autoRotate = false; // Detiene la órbita automática
      
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

      highlightNodes.clear(); 
      highlightLinks.clear();
      
      highlightNodes.add(node);
      if (node.neighbors) node.neighbors.forEach(v => highlightNodes.add(v));
      
      // Enciende el cordón hasta el centro
      trazarRutaAlNucleo(node);
      
      actualizarFiltroVisual(); 
      
      // Zoom suave al nodo
      const distRatio = 1 + 60 / Math.hypot(node.x, node.y, node.z);
      Graph.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
    })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear(); 
      highlightLinks.clear();
      actualizarFiltroVisual();
      
      // Reactiva la órbita
      Graph.controls().autoRotate = true; 
    });

  // 5. CONFIGURACIÓN DE FÍSICA PARA RED DENSA
  // Reducimos las distancias a la mitad para que no se vea el "efecto lejanía"
  Graph.d3Force('charge').strength(-80); 
  Graph.d3Force('link').distance(link => (link.source.id === 'Omni-Eco' || link.target.id === 'Omni-Eco') ? 70 : 25);

  // 6. FONDO ESPACIAL ESTÁTICO
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 4000;
  const posArray = new Float32Array(starsCount * 3);
  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 3000;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMat = new THREE.PointsMaterial({
    size: 1.2, color: 0x00f5d4, transparent: true, opacity: 0.4, sizeAttenuation: true
  });
  Graph.scene().add(new THREE.Points(starsGeo, starsMat));
  
  // Luces para resaltar los cristales
  Graph.scene().add(new THREE.AmbientLight(0xffffff, 0.8));
  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(100, 200, 100);
  Graph.scene().add(light);

  // 7. CONTROLES DE CÁMARA (INERCIA Y ÓRBITA LENTA)
  const controls = Graph.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.2; // Muy lento, majestuoso
  controls.enableDamping = true;  // Efecto deslizamiento (inercia)
  controls.dampingFactor = 0.08;  // Depende de qué tan fuerte gires el mouse
  
  // Si mueves manualmente, detiene la órbita. Al soltar, resbala por la inercia.
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { 
    if (highlightNodes.size === 0) {
      setTimeout(() => { controls.autoRotate = true; }, 3000); 
    }
  });
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  Graph.graphData().nodes.forEach(node => {
    if (node.__threeObj) {
      const enfocado = highlightNodes.has(node);
      
      // Control de opacidad:
      // Cristal Interno: 70% normal, 30% si está enfocado, 5% si está apagado
      const opacidadCristal = hayFoco ? (enfocado ? 0.3 : 0.05) : 0.7;
      // Halo Neón: 20% normal, 60% enfocado (brilla más), 0% apagado
      const opacidadHalo = hayFoco ? (enfocado ? 0.6 : 0.0) : 0.2;
      // Texto: 100% normal, 100% enfocado, 5% apagado
      const opacidadTexto = hayFoco ? (enfocado ? 1.0 : 0.05) : 1.0;

      const group = node.__threeObj.children;
      if (group[0] && group[0].material) group[0].material.opacity = opacidadCristal;
      if (group[1] && group[1].material) group[1].material.opacity = opacidadHalo;
      if (group[2] && group[2].material) group[2].material.opacity = opacidadTexto;
    }
  });
  
  // Recalcular enlaces
  Graph.linkColor(Graph.linkColor())
       .linkWidth(Graph.linkWidth())
       .linkDirectionalParticles(Graph.linkDirectionalParticles());
}

// LÓGICA DE BUSCADOR
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
