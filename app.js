// ==============================================================================
// ECONOMITRÓN - CRISTALES SÓLIDOS, LÁSER Y TABS (RESTAURADO)
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyKF3KUVC9HpccVUocbaHojMN8DpY4WC1gwI-fTI98-0ykiHubBbt6GMUsC6Aa7zKWqRQ/exec'; // Verifica que sea tu URL correcta

let Graph;
const highlightNodes = new Set();
const highlightLinks = new Set();

function switchTab(tabId) {
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active-view'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active-view');
  event.currentTarget.classList.add('active');
}

fetch(API_URL)
  .then(res => res.json())
  .then(data => {
    document.getElementById('loading').style.display = 'none';
    
    // Crecimiento orgánico: +0.1% por grado
    data.nodes.forEach(n => {
      let baseSize = n.group === 'Raiz' ? 14 : (n.group === 'Asignatura' ? 8 : (n.group === 'Wormhole' ? 6 : 4));
      n.val = baseSize * (1 + ((n.grado || 0) * 0.1));
      n.color = n.color || '#ffffff';
    });

    renderizarGrafo(data);
  })
  .catch(err => {
    document.getElementById('loading').innerText = 'ERROR DE CONEXIÓN: ' + err.message;
  });

function trazarRutaAlNucleo(startNode) {
  const queue = [[startNode]];
  const visited = new Set([startNode.id]);
  let shortestPath = null;
  const linksArray = Graph.graphData().links;

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current.id === 'Omni-Eco' || current.group === 'Raiz') {
      shortestPath = path;
      break;
    }

    // Buscar vecinos mediante las aristas
    const neighbors = [];
    linksArray.forEach(l => {
      if (l.source.id === current.id && !visited.has(l.target.id)) neighbors.push(l.target);
      if (l.target.id === current.id && !visited.has(l.source.id)) neighbors.push(l.source);
    });

    for (let neighbor of neighbors) {
      visited.add(neighbor.id);
      queue.push([...path, neighbor]);
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
    .backgroundColor('#040509') 
    .showNavInfo(false)
    .cooldownTicks(200)
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    
    // ARISTAS LÁSER (Delgadas y con apagado estricto)
    .linkColor(link => highlightLinks.has(link) ? '#00ffff' : '#00d2ff') 
    .linkVisibility(link => {
      if (highlightNodes.size === 0) return true;
      return highlightLinks.has(link);
    })
    .linkOpacity(link => {
      if (highlightNodes.size === 0) return 0.25; 
      return highlightLinks.has(link) ? 0.8 : 0.0; 
    })
    .linkWidth(link => {
      if (highlightNodes.size === 0) return 0.3; 
      return highlightLinks.has(link) ? 0.8 : 0.0; 
    })
    // Direccionalidad reflejada en partículas, no en flechas gigantes
    .linkDirectionalParticles(link => highlightLinks.has(link) ? (link.type === 'bidirectional' ? 5 : 3) : 0) 
    .linkDirectionalParticleSpeed(link => link.type === 'bidirectional' ? 0.015 : 0.008)
    .linkDirectionalParticleWidth(2.0)
    .linkDirectionalParticleColor(() => '#ffffff') 

    // NODOS HOLOGRÁFICOS RESTAURADOS
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const esRaiz = node.group === 'Raiz';
      
      // Aumento Lumínico: +0.1 por grado
      const extraGlow = Math.min((node.grado || 0) * 0.1, 0.4);

      const geometry = new THREE.SphereGeometry(node.val * 0.8, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: node.color,
        transparent: true,
        opacity: 0.55 + extraGlow, // Solidez base + brillo por conexiones
        depthWrite: false, 
        blending: THREE.AdditiveBlending 
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      const sprite = new SpriteText(node.name || node.id);
      sprite.color = 'rgba(255, 255, 255, 0.9)'; 
      sprite.textHeight = esRaiz ? 3.5 : Math.max(1.8, node.val * 0.35);
      sprite.position.y = (node.val * 0.8) + 2.5;
      sprite.fontFace = "'Rajdhani', sans-serif";
      sprite.fontWeight = '700';
      group.add(sprite);

      return group;
    })

    .onNodeClick(node => {
      Graph.controls().autoRotate = false; 
      
      document.getElementById('card-title').innerText = node.name;
      document.getElementById('card-id').innerText = node.id;
      document.getElementById('card-grado').innerText = node.grado || 0;
      
      const btnDoc = document.getElementById('btn-doc');
      if (node.url && node.url.includes('http')) {
        btnDoc.href = node.url; btnDoc.style.display = 'inline-block';
      } else {
        if(btnDoc) btnDoc.style.display = 'none';
      }
      document.getElementById('info-card').style.display = 'block';

      highlightNodes.clear(); highlightLinks.clear();
      highlightNodes.add(node);
      
      // Resaltar conexiones inmediatas
      data.links.forEach(l => {
        if (l.source.id === node.id || l.target.id === node.id) {
          highlightLinks.add(l);
          highlightNodes.add(l.source);
          highlightNodes.add(l.target);
        }
      });
      
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

  // MICRO-ESTRELLAS ILUMINADAS RESTAURADAS
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 2000;
  const posArray = new Float32Array(starsCount * 3);
  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 3000;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMat = new THREE.PointsMaterial({
    size: 2.2, color: 0x88ffff, transparent: true, opacity: 0.9, sizeAttenuation: true
  });
  const starMesh = new THREE.Points(starsGeo, starsMat);
  Graph.scene().add(starMesh);

  // FILTRO BLOOM (Luz dinámica controlada)
  const bloomPass = new THREE.UnrealBloomPass();
  bloomPass.strength = 0.45;  
  bloomPass.radius = 0.15;    
  bloomPass.threshold = 0.2;  
  Graph.postProcessingComposer().addPass(bloomPass);

  const controls = Graph.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3; 
  controls.enableDamping = true;  
  controls.dampingFactor = 0.08;  
  
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { 
    if (highlightNodes.size === 0) setTimeout(() => { controls.autoRotate = true; }, 2000); 
  });

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
      const extraGlow = Math.min((node.grado || 0) * 0.1, 0.4);
      
      const opacidadCristal = hayFoco ? (enfocado ? 0.85 : 0.05) : 0.55 + extraGlow;
      const opacidadTexto = hayFoco ? (enfocado ? 1.0 : 0.0) : 1.0;

      const group = node.__threeObj.children;
      if (group[0] && group[0].material) group[0].material.opacity = opacidadCristal;
      if (group[1]) group[1].material.opacity = opacidadTexto;
    }
  });
  
  Graph.linkColor(Graph.linkColor())
       .linkOpacity(Graph.linkOpacity())
       .linkWidth(Graph.linkWidth())
       .linkVisibility(Graph.linkVisibility())
       .linkDirectionalParticles(Graph.linkDirectionalParticles());
}

document.getElementById('btn-buscar').addEventListener('click', () => {
  const texto = document.getElementById('buscador').value.toLowerCase().trim();
  if (!texto || !Graph) return;
  const target = Graph.graphData().nodes.find(n => 
    (n.id && n.id.toLowerCase().includes(texto)) || (n.name && n.name.toLowerCase().includes(texto))
  );
  
  if (target) {
    const ratio = 1 + 60 / Math.hypot(target.x, target.y, target.z);
    Graph.cameraPosition({ x: target.x * ratio, y: target.y * ratio, z: target.z * ratio }, target, 1500);
  }
});
