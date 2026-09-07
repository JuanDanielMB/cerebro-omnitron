// ==============================================================================
// ECONOMITRÓN - MAPA DE CALOR, LATIDO TÉRMICO Y ECHARTS
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycby6e-6mf9BN4JUnEMCeZdFLCHn6sef6rqQjn4gmQrRCQbtkLQKpbgo3oFjrVOIpVsD83g/exec';
let Graph;
let globalNodes = []; 
const highlightNodes = new Set();
const highlightLinks = new Set();

// 1. GENERADOR DE PLASMA (AURA TÉRMICA) EN MEMORIA
const glowTexture = (function() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255, 1.0)'); // Núcleo incandescente
  gradient.addColorStop(0.3, 'rgba(255,255,255, 0.6)'); // Corona térmica
  gradient.addColorStop(1, 'rgba(255,255,255, 0.0)'); // Desvanecimiento absoluto
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
})();

function switchTab(tabId) {
  document.querySelectorAll('.view-container, .tab-btn').forEach(el => el.classList.remove('active-view', 'active'));
  document.getElementById(tabId).classList.add('active-view');
  event.currentTarget.classList.add('active');
  
  if (typeof echarts !== 'undefined') {
    const s = echarts.getInstanceByDom(document.getElementById('sankey-chart'));
    const t = echarts.getInstanceByDom(document.getElementById('treemap-chart'));
    if (s) s.resize(); if (t) t.resize();
  }
}

const colorBrillante100 = (hex) => {
  let c = (hex || '').replace('#', '').trim();
  if (c.length !== 6) return '#ffffff';
  let rgb = [0, 2, 4].map(i => Math.min(255, parseInt(c.substr(i, 2), 16) + 45));
  return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
};

function colorDeArista(link) {
  const sourceNode = typeof link.source === 'object' ? link.source : globalNodes.find(n => n.id === link.source);
  if (!sourceNode) return 'rgba(255, 255, 255, 0.25)';
  if (sourceNode.group === 'Raiz') return '#0055ff';
  if (sourceNode.group === 'Asignatura') return '#b100ff';
  if (sourceNode.group === 'Termino') return '#000080';
  return '#ffffff';
}

function obtenerRutaNucleo(startNode, links) {
  const queue = [[startNode]];
  const visited = new Set([startNode.id]);
  
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (current.id === 'Omni-Eco' || current.group === 'Raiz') return path;
    
    links.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;

      if (sId === current.id && !visited.has(tId)) {
        visited.add(tId);
        const nextNode = typeof l.target === 'object' ? l.target : globalNodes.find(n => n.id === tId);
        if(nextNode) queue.push([...path, nextNode]);
      } else if (tId === current.id && !visited.has(sId)) {
        visited.add(sId);
        const nextNode = typeof l.source === 'object' ? l.source : globalNodes.find(n => n.id === sId);
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

    const nodeIds = new Set(data.nodes.map(n => n.id));
    data.links = data.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    data.nodes.forEach(n => n.grado = 0);
    data.links.forEach(l => {
      const s = data.nodes.find(n => n.id === l.source);
      const t = data.nodes.find(n => n.id === l.target);
      if (s) s.grado++; if (t) t.grado++;
    });

    data.nodes.forEach(n => {
      const baseSize = n.group === 'Raiz' ? 3.0 : (n.group === 'Asignatura' ? 2.5 : 1.5);
      n.val = baseSize * (1 + (n.grado * 0.05));
      n.color = colorBrillante100(n.color);
      if (n.url) n.url = n.url.trim();
    });

    globalNodes = data.nodes; 
    renderizarGrafo(data);
    renderizarECharts(data);
  })
  .catch(err => document.getElementById('loading').innerText = 'ERROR: ' + err.message);

function renderizarGrafo(data) {
  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#000000')
    .showNavInfo(false)
    .linkColor(colorDeArista) 
    .linkOpacity(0.25)
    .linkDirectionalParticles(2) 
    .linkDirectionalParticleSpeed(0.008)
    .linkDirectionalParticleWidth(1.2)
    .linkDirectionalParticleColor(colorDeArista)
    
    // 2. CONSTRUCCIÓN DEL MAPA DE CALOR
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      
      // Capa A: El Aura Térmica (Sprite AdditiveBlending)
      const baseOpacity = Math.min(1.0, 0.1 + (node.grado * 0.08)); // Crece con las conexiones
      const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: node.color,
        transparent: true,
        blending: THREE.AdditiveBlending, // Mezcla de luz pura
        depthWrite: false,
        opacity: baseOpacity
      });
      const glowSprite = new THREE.Sprite(glowMat);
      
      // Escala del aura: Exponencial para los nodos críticos
      const glowScale = node.val * (1.5 + (node.grado * 0.12));
      glowSprite.scale.set(glowScale, glowScale, 1);
      
      // Guardamos referencias para animar luego
      node.__glowBaseScale = glowScale;
      node.__glowBaseOpacity = baseOpacity;
      node.__glowSprite = glowSprite;

      // Capa B: Esfera Sólida (Núcleo)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(node.val * 0.8, 16, 16),
        new THREE.MeshBasicMaterial({ color: node.color, opacity: 1.0, transparent: true, depthWrite: false })
      );

      // Capa C: Etiqueta
      const spriteText = new SpriteText(node.name || node.id);
      spriteText.color = 'rgba(255, 255, 255, 1.0)';
      spriteText.textHeight = node.group === 'Raiz' ? 3.0 : Math.max(1.5, node.val * 0.4);
      spriteText.position.y = (node.val * 0.8) + 2.0;
      spriteText.fontFace = "'Rajdhani', sans-serif";
      spriteText.fontWeight = '700';
      
      group.add(glowSprite, mesh, spriteText);
      node.__threeGroup = group;
      return group;
    })
    .onNodeClick(node => {
      Graph.controls().autoRotate = false;
      
      const infoCard = document.getElementById('info-card');
      if (infoCard) { infoCard.style.display = 'block'; infoCard.style.zIndex = '1000'; }
      
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
      links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        if (sId === node.id || tId === node.id) {
          highlightLinks.add(l); 
          const sNode = typeof l.source === 'object' ? l.source : globalNodes.find(n => n.id === sId);
          const tNode = typeof l.target === 'object' ? l.target : globalNodes.find(n => n.id === tId);
          if (sNode) highlightNodes.add(sNode); 
          if (tNode) highlightNodes.add(tNode);
        }
      });
      
      const path = obtenerRutaNucleo(node, links);
      if (path) {
        path.forEach(n => highlightNodes.add(n));
        for (let i = 0; i < path.length - 1; i++) {
          const l = links.find(l => {
              const sId = typeof l.source === 'object' ? l.source.id : l.source;
              const tId = typeof l.target === 'object' ? l.target.id : l.target;
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

  Graph.d3Force('charge').strength(n => -80 - ((n.grado || 0) * 10)); 
  Graph.d3Force('link').distance(l => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source;
    const tId = typeof l.target === 'object' ? l.target.id : l.target;
    return (sId === 'Omni-Eco' || tId === 'Omni-Eco') ? 160 : 45; 
  });

  Graph.controls().autoRotate = true;
  Graph.controls().autoRotateSpeed = 0.3;
  Graph.controls().enableDamping = true;
  Graph.controls().addEventListener('start', () => Graph.controls().autoRotate = false);
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  
  Graph.graphData().nodes.forEach(n => {
    if (n.__threeGroup) {
      const enfocado = highlightNodes.has(n);
      // Apagamos los nodos inactivos y su aura térmica durante el foco
      n.__threeGroup.children[0].material.opacity = hayFoco ? (enfocado ? n.__glowBaseOpacity : 0.0) : n.__glowBaseOpacity; // Aura
      n.__threeGroup.children[1].material.opacity = hayFoco ? (enfocado ? 1.0 : 0.10) : 1.0; // Esfera sólida
      n.__threeGroup.children[2].material.opacity = hayFoco ? (enfocado ? 1.0 : 0.0) : 1.0; // Texto
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

// 3. EL MARCAPASOS: Lógica del Latido Térmico (Request Animation Frame)
(function animarLatidos() {
  requestAnimationFrame(animarLatidos);
  if (!Graph) return;
  
  const time = Date.now() * 0.001; // Segundos
  const hayFoco = highlightNodes.size > 0;

  Graph.graphData().nodes.forEach(n => {
    if (n.__glowSprite && n.__glowBaseOpacity > 0) {
      if (hayFoco && !highlightNodes.has(n)) return; // No animar nodos apagados
      
      let speed, amplitude;
      // Jerarquía de Latidos
      if (n.group === 'Raiz') { 
        speed = 1.0; amplitude = 0.15; // Lento y profundo (Ancla)
      } else if (n.group === 'Asignatura') { 
        speed = 2.5; amplitude = 0.12; // Rápido (Alto tráfico)
      } else { 
        speed = 0.8; amplitude = 0.05; // Periférico y sutil
      }
      
      // Onda matemática de latido
      const latido = Math.sin(time * speed) * amplitude;
      
      // Escalar Aura
      const currentScale = n.__glowBaseScale * (1 + latido);
      n.__glowSprite.scale.set(currentScale, currentScale, 1);
      
      // Pulsar Opacidad
      n.__glowSprite.material.opacity = n.__glowBaseOpacity + (latido * 0.5);
    }
  });
})();

// ECHARTS (Sankey & Treemap)
function renderizarECharts(data) {
  const sankeyDom = document.getElementById('sankey-chart');
  if (sankeyDom) {
    const sankeyChart = echarts.init(sankeyDom);
    const sNodes = data.nodes.map(n => ({ name: n.id, label: { formatter: n.name }, itemStyle: { color: n.color } }));
    const sLinks = [];
    data.links.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      const sNode = globalNodes.find(n => n.id === sId);
      const tNode = globalNodes.find(n => n.id === tId);
      if (sNode && tNode && ((sNode.group === 'Raiz' && tNode.group === 'Asignatura') || (sNode.group === 'Asignatura' && tNode.group === 'Termino'))) {
        sLinks.push({ source: sId, target: tId, value: 1 });
      }
    });
    sankeyChart.setOption({
      backgroundColor: '#000000', tooltip: { trigger: 'item' },
      series: [{ type: 'sankey', layout: 'none', focusNodeAdjacency: 'allEdges', data: sNodes, links: sLinks, lineStyle: { color: 'source', curveness: 0.5, opacity: 0.2 }, label: { color: '#ffffff', fontSize: 12 } }]
    });
  }

  const treeDom = document.getElementById('treemap-chart');
  if (treeDom) {
    const treeChart = echarts.init(treeDom);
    const rootTree = { name: 'Omni-Eco', itemStyle: { color: '#0055ff' }, children: [] };
    const asignaturas = data.nodes.filter(n => n.group === 'Asignatura');
    asignaturas.forEach(a => {
      const hijos = data.nodes.filter(n => n.group === 'Termino' && data.links.some(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return (sId === a.id && tId === n.id) || (tId === a.id && sId === n.id);
      }));
      rootTree.children.push({ name: a.name, value: 1 + hijos.length, itemStyle: { color: a.color }, children: hijos.map(c => ({ name: c.name, value: 1, itemStyle: { color: c.color } })) });
    });
    treeChart.setOption({
      backgroundColor: '#000000', tooltip: { formatter: '{b}' },
      series: [{ type: 'treemap', data: [rootTree], roam: true, itemStyle: { borderColor: '#000', borderWidth: 2 }, label: { color: '#fff', fontSize: 14, fontWeight: 'bold' } }]
    });
  }
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
