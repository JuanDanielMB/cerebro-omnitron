// ==============================================================================
// ECONOMITRÓN - NÚCLEO OPTIMIZADO V2.0 (CLEAN CODE)
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycby6e-6mf9BN4JUnEMCeZdFLCHn6sef6rqQjn4gmQrRCQbtkLQKpbgo3oFjrVOIpVsD83g/exec';
let Graph;
const highlightNodes = new Set();
const highlightLinks = new Set();

// 1. UTILIDADES Y UI
function switchTab(tabId) {
  document.querySelectorAll('.view-container, .tab-btn').forEach(el => el.classList.remove('active-view', 'active'));
  document.getElementById(tabId).classList.add('active-view');
  event.currentTarget.classList.add('active');
}

// Inyección de 100% brillo en colores
const colorBrillante100 = (hex) => {
  let c = (hex || '').replace('#', '').trim();
  if (c.length !== 6) return '#ffffff';
  let rgb = [0, 2, 4].map(i => Math.min(255, parseInt(c.substr(i, 2), 16) + 45));
  return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
};

// Algoritmo BFS simplificado para encontrar la raíz
function obtenerRutaNucleo(startNode, links) {
  const queue = [[startNode]];
  const visited = new Set([startNode.id]);
  
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    
    if (current.id === 'Omni-Eco' || current.group === 'Raiz') return path;
    
    links.forEach(l => {
      if (l.source.id === current.id && !visited.has(l.target.id)) {
        visited.add(l.target.id); queue.push([...path, l.target]);
      } else if (l.target.id === current.id && !visited.has(l.source.id)) {
        visited.add(l.source.id); queue.push([...path, l.source]);
      }
    });
  }
  return null;
}

// 2. INGESTA DE DATOS (ETL LOCAL)
fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" })
  .then(res => res.json())
  .then(data => {
    document.getElementById('loading').style.display = 'none';
    
    // Cálculo de grados (Conexiones)
    data.nodes.forEach(n => n.grado = 0);
    data.links.forEach(l => {
      const s = data.nodes.find(n => n.id === l.source);
      const t = data.nodes.find(n => n.id === l.target);
      if (s) s.grado++; if (t) t.grado++;
    });

    // Sanitización y Escalamiento
    data.nodes.forEach(n => {
      const baseSize = n.group === 'Raiz' ? 7 : (n.group === 'Asignatura' ? 4 : 2);
      n.val = baseSize * (1 + (n.grado * 0.15));
      n.color = colorBrillante100(n.color);
      if (n.url) n.url = n.url.trim();
    });

    renderizarGrafo(data);
  })
  .catch(err => document.getElementById('loading').innerText = 'ERROR: ' + err.message);

// 3. MOTOR DE RENDERIZADO WEBGL
function renderizarGrafo(data) {
  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#000000')
    .showNavInfo(false)
    
    // ARISTAS INVISIBLES Y FOTONES
    .linkColor(() => 'rgba(0,0,0,0)') 
    .linkDirectionalParticles(2) 
    .linkDirectionalParticleSpeed(0.008)
    .linkDirectionalParticleWidth(3.0)
    .linkDirectionalParticleColor(l => l.source.color || '#ffffff')

    // GEOMETRÍA DE NODOS
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(node.val * 0.8, 16, 16),
        new THREE.MeshBasicMaterial({ color: node.color, opacity: 1.0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      const sprite = new SpriteText(node.name || node.id);
      sprite.color = 'rgba(255, 255, 255, 1.0)';
      sprite.textHeight = node.group === 'Raiz' ? 3.0 : Math.max(1.5, node.val * 0.4);
      sprite.position.y = (node.val * 0.8) + 2.0;
      sprite.fontFace = "'Rajdhani', sans-serif";
      sprite.fontWeight = '700';
      
      group.add(mesh, sprite);
      return group;
    })

    // INTERACCIÓN
    .onNodeClick(node => {
      Graph.controls().autoRotate = false;
      document.getElementById('card-title').innerText = node.name;
      document.getElementById('card-id').innerText = node.id;
      document.getElementById('card-grado').innerText = node.grado || 0;
      
      const btnDoc = document.getElementById('btn-doc');
      if (btnDoc) {
        btnDoc.style.display = (node.url && node.url.startsWith('http')) ? 'block' : 'none';
        btnDoc.href = node.url || '#';
      }
      document.getElementById('info-card').style.display = 'block';

      highlightNodes.clear(); highlightLinks.clear();
      highlightNodes.add(node);

      const links = Graph.graphData().links;
      
      // Enfocar vecinos directos
      links.forEach(l => {
        if (l.source.id === node.id || l.target.id === node.id) {
          highlightLinks.add(l); highlightNodes.add(l.source); highlightNodes.add(l.target);
        }
      });
      
      // Trazar cordón umbilical
      const path = obtenerRutaNucleo(node, links);
      if (path) {
        path.forEach(n => highlightNodes.add(n));
        for (let i = 0; i < path.length - 1; i++) {
          const l = links.find(l => (l.source.id === path[i].id && l.target.id === path[i+1].id) || (l.target.id === path[i].id && l.source.id === path[i+1].id));
          if (l) highlightLinks.add(l);
        }
      }
      
      actualizarFiltroVisual();
      const d = Math.hypot(node.x, node.y, node.z) || 0.1;
      Graph.cameraPosition({ x: node.x * (1 + 45/d), y: node.y * (1 + 45/d), z: node.z * (1 + 45/d) }, node, 1500);
    })
    .onNodeDoubleClick(node => { if (node.url && node.url.startsWith('http')) window.open(node.url, '_blank'); })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear(); highlightLinks.clear();
      actualizarFiltroVisual();
      setTimeout(() => { Graph.controls().autoRotate = true; }, 800);
    });

  // FÍSICAS ESTABILIZADAS
  Graph.d3Force('charge').strength(n => -60 - ((n.grado || 0) * 8)); 
  Graph.d3Force('link').distance(l => (l.source.id === 'Omni-Eco' || l.target.id === 'Omni-Eco') ? 80 : 35);

  Graph.controls().autoRotate = true;
  Graph.controls().autoRotateSpeed = 0.3;
  Graph.controls().enableDamping = true;
  Graph.controls().addEventListener('start', () => Graph.controls().autoRotate = false);
}

// 4. SHADER DINÁMICO DE ESTADOS
function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  
  Graph.graphData().nodes.forEach(n => {
    if (n.__threeObj) {
      const enfocado = highlightNodes.has(n);
      n.__threeObj.children[0].material.opacity = hayFoco ? (enfocado ? 1.0 : 0.10) : 1.0;
      n.__threeObj.children[1].material.opacity = hayFoco ? (enfocado ? 1.0 : 0.0) : 1.0;
    }
  });
  
  Graph.linkDirectionalParticles(l => hayFoco ? (highlightLinks.has(l) ? 6 : 0) : 2)
       .linkDirectionalParticleSpeed(l => hayFoco && highlightLinks.has(l) ? 0.020 : 0.008)
       .linkDirectionalParticleColor(l => hayFoco && highlightLinks.has(l) ? '#ffffff' : (l.source.color || '#ffffff'));
}

// 5. MOTOR DE BÚSQUEDA
document.getElementById('btn-buscar').addEventListener('click', () => {
  const txt = document.getElementById('buscador').value.toLowerCase().trim();
  if (!txt || !Graph) return;
  const target = Graph.graphData().nodes.find(n => (n.id && n.id.toLowerCase().includes(txt)) || (n.name && n.name.toLowerCase().includes(txt)));
  
  if (target) {
    const d = Math.hypot(target.x, target.y, target.z) || 0.1;
    Graph.cameraPosition({ x: target.x * (1 + 60/d), y: target.y * (1 + 60/d), z: target.z * (1 + 60/d) }, target, 1500);
  }
});
