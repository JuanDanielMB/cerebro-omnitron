// ==============================================================================
// ECONOMITRÓN - FÍSICAS BLINDADAS (D3 / 3D-FORCE-GRAPH) Y HUD RESTAURADO
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycby6e-6mf9BN4JUnEMCeZdFLCHn6sef6rqQjn4gmQrRCQbtkLQKpbgo3oFjrVOIpVsD83g/exec';
let Graph;
const highlightNodes = new Set();
const highlightLinks = new Set();

function switchTab(tabId) {
  document.querySelectorAll('.view-container, .tab-btn').forEach(el => el.classList.remove('active-view', 'active'));
  document.getElementById(tabId).classList.add('active-view');
  event.currentTarget.classList.add('active');
}

const colorBrillante100 = (hex) => {
  let c = (hex || '').replace('#', '').trim();
  if (c.length !== 6) return '#ffffff';
  let rgb = [0, 2, 4].map(i => Math.min(255, parseInt(c.substr(i, 2), 16) + 45));
  return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
};

// 1. ESCUDOS DE SEGURIDAD D3: Previenen el colapso a coordenadas (0,0,0)
const getId = node => typeof node === 'object' ? node.id : node;
const getNode = (node, nodes) => typeof node === 'object' ? node : nodes.find(n => n.id === node);

// Restauración estricta de jerarquía de color
function colorDeArista(link) {
  const nodes = Graph.graphData().nodes;
  const sourceNode = getNode(link.source, nodes);
  if (!sourceNode) return 'rgba(255, 255, 255, 0.25)';
  if (sourceNode.group === 'Raiz') return '#0055ff';
  if (sourceNode.group === 'Asignatura') return '#b100ff';
  if (sourceNode.group === 'Termino') return '#000080';
  return '#ffffff';
}

function obtenerRutaNucleo(startNode, links, nodes) {
  const queue = [[startNode]];
  const visited = new Set([startNode.id]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (current.id === 'Omni-Eco' || current.group === 'Raiz') return path;

    links.forEach(l => {
      const sId = getId(l.source);
      const tId = getId(l.target);

      if (sId === current.id && !visited.has(tId)) {
        visited.add(tId);
        const nextNode = getNode(l.target, nodes);
        if(nextNode) queue.push([...path, nextNode]);
      } else if (tId === current.id && !visited.has(sId)) {
        visited.add(sId);
        const nextNode = getNode(l.source, nodes);
        if(nextNode) queue.push([...path, nextNode]);
      }
    });
  }
  return null;
}

fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" })
  .then(res => res.json())
  .then(data => {
    document.getElementById('loading').style.display = 'none';

    // 2. FILTRO DE CUARENTENA CRÍTICO: Aniquila referencias rotas antes de que maten a D3
    const nodeIds = new Set(data.nodes.map(n => n.id));
    data.links = data.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    data.nodes.forEach(n => n.grado = 0);
    data.links.forEach(l => {
      const s = data.nodes.find(n => n.id === l.source);
      const t = data.nodes.find(n => n.id === l.target);
      if (s) s.grado++; if (t) t.grado++;
    });

    data.nodes.forEach(n => {
      const baseSize = n.group === 'Raiz' ? 7 : (n.group === 'Asignatura' ? 4 : 2);
      n.val = baseSize * (1 + (n.grado * 0.15));
      n.color = colorBrillante100(n.color);
      if (n.url) n.url = n.url.trim();
    });

    renderizarGrafo(data);
  })
  .catch(err => document.getElementById('loading').innerText = 'ERROR: ' + err.message);

function renderizarGrafo(data) {
  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#000000')
    .showNavInfo(false)

    // LÍNEAS 2D Y FOTONES REDUCIDOS
    .linkColor(colorDeArista)
    .linkOpacity(0.25)
    .linkWidth(0) // Obliga a WebGL a usar líneas de 1px en lugar del cilindro 3D
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(0.008)
    .linkDirectionalParticleWidth(1.2)
    .linkDirectionalParticleColor(colorDeArista)

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

    .onNodeClick(node => {
      Graph.controls().autoRotate = false;
      
      // 3. INYECCIÓN Z-INDEX: Garantiza que el HUD flote por encima del renderizado WebGL
      const infoCard = document.getElementById('info-card');
      if (infoCard) {
        infoCard.style.display = 'block';
        infoCard.style.zIndex = '1000'; 
      }
      
      document.getElementById('card-title').innerText = node.name;
      document.getElementById('card-id').innerText = node.id;
      document.getElementById('card-grado').innerText = node.grado || 0;

      const btnDoc = document.getElementById('btn-doc');
      if (btnDoc) {
        btnDoc.style.display = (node.url && node.url.startsWith('http')) ? 'block' : 'none';
        btnDoc.href = node.url || '#';
      }

      highlightNodes.clear(); highlightLinks.clear();
      highlightNodes.add(node);

      const links = Graph.graphData().links;
      const nodes = Graph.graphData().nodes;
      
      links.forEach(l => {
        const sId = getId(l.source);
        const tId = getId(l.target);
        if (sId === node.id || tId === node.id) {
          highlightLinks.add(l); 
          const sNode = getNode(l.source, nodes);
          const tNode = getNode(l.target, nodes);
          if (sNode) highlightNodes.add(sNode); 
          if (tNode) highlightNodes.add(tNode);
        }
      });

      const path = obtenerRutaNucleo(node, links, nodes);
      if (path) {
        path.forEach(n => highlightNodes.add(n));
        for (let i = 0; i < path.length - 1; i++) {
          const l = links.find(l => {
              const sId = getId(l.source);
              const tId = getId(l.target);
              return (sId === path[i].id && tId === path[i+1].id) || (tId === path[i].id && sId === path[i+1].id);
          });
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

  // 4. GRAVEDAD BLINDADA
  Graph.d3Force('charge').strength(n => -60 - ((n.grado || 0) * 8));
  Graph.d3Force('link').distance(l => {
    const sId = getId(l.source);
    const tId = getId(l.target);
    return (sId === 'Omni-Eco' || tId === 'Omni-Eco') ? 80 : 35;
  });

  Graph.controls().autoRotate = true;
  Graph.controls().autoRotateSpeed = 0.3;
  Graph.controls().enableDamping = true;
  Graph.controls().addEventListener('start', () => Graph.controls().autoRotate = false);
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;

  Graph.graphData().nodes.forEach(n => {
    if (n.__threeObj) {
      const enfocado = highlightNodes.has(n);
      n.__threeObj.children[0].material.opacity = hayFoco ? (enfocado ? 1.0 : 0.10) : 1.0;
      n.__threeObj.children[1].material.opacity = hayFoco ? (enfocado ? 1.0 : 0.0) : 1.0;
    }
  });

  Graph.linkColor(l => {
        if (!hayFoco) return colorDeArista(l);
        return highlightLinks.has(l) ? '#00ffff' : colorDeArista(l);
      })
       .linkOpacity(l => {
        if (!hayFoco) return 0.25;
        return highlightLinks.has(l) ? 0.9 : 0.02;
      })
       .linkDirectionalParticles(l => hayFoco ? (highlightLinks.has(l) ? 5 : 0) : 2)
       .linkDirectionalParticleSpeed(l => hayFoco && highlightLinks.has(l) ? 0.020 : 0.008)
       .linkDirectionalParticleColor(l => hayFoco && highlightLinks.has(l) ? '#ffffff' : colorDeArista(l));
}

document.getElementById('btn-buscar').addEventListener('click', () => {
  const txt = document.getElementById('buscador').value.toLowerCase().trim();
  if (!txt || !Graph) return;
  const target = Graph.graphData().nodes.find(n => (n.id && n.id.toLowerCase().includes(txt)) || (n.name && n.name.toLowerCase().includes(txt)));

  if (target) {
    const d = Math.hypot(target.x, target.y, target.z) || 0.1;
    Graph.cameraPosition({ x: target.x * (1 + 60/d), y: target.y * (1 + 60/d), z: target.z * (1 + 60/d) }, target, 1500);
  }
});
