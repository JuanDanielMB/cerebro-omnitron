// ==============================================================================
// ECONOMITRÓN - RENDERIZADOR PRINCIPAL
// ==============================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyKF3KUVC9HpccVUocbaHojMN8DpY4WC1gwI-fTI98-0ykiHubBbt6GMUsC6Aa7zKWqRQ/exec'; // ¡Pega tu nueva URL aquí!

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
    
    // Asignación de tamaños basados en la regla de +0.1% de crecimiento
    data.nodes.forEach(n => {
      let baseSize = n.group === 'Raiz' ? 15 : (n.group === 'Asignatura' ? 8 : (n.group === 'Wormhole' ? 6 : 4));
      // Crecimiento orgánico: base * (1 + (grado * 0.1))
      n.val = baseSize * (1 + ((n.grado || 0) * 0.1)); 
    });

    renderizarGrafo(data);
  });

function renderizarGrafo(data) {
  Graph = ForceGraph3D()(document.getElementById('graph-container'))
    .graphData(data)
    .backgroundColor('#020306')
    .showNavInfo(false)
    .cooldownTicks(150)
    
    // CONFIGURACIÓN DE ARISTAS (Con soporte direccional)
    .linkColor(link => highlightLinks.has(link) ? '#00ffff' : 'rgba(0, 85, 255, 0.3)')
    .linkWidth(link => highlightLinks.has(link) ? 1.5 : 0.2)
    .linkDirectionalArrowLength(link => link.type === 'unidirectional' ? 3.5 : 0) // Flechas para direccionalidad
    .linkDirectionalArrowRelPos(1) // Apuntan al objetivo
    .linkDirectionalParticles(link => highlightLinks.has(link) ? (link.type === 'bidirectional' ? 4 : 2) : 0)
    .linkDirectionalParticleSpeed(link => link.type === 'bidirectional' ? 0.015 : 0.008)
    .linkDirectionalParticleColor(() => '#ffffff')

    // NODOS
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      
      // Aumento Lumínico (Bloom): Opacidad base + 0.1 por conexión
      const extraGlow = Math.min((node.grado || 0) * 0.1, 0.5); 
      const opacityLevel = node.group === 'Wormhole' ? 0.2 : (0.4 + extraGlow);

      const geometry = new THREE.SphereGeometry(node.val, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: node.color, 
        transparent: true, 
        opacity: opacityLevel, 
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      group.add(new THREE.Mesh(geometry, material));

      const sprite = new SpriteText(node.name || node.id);
      sprite.color = 'rgba(255, 255, 255, 0.9)'; 
      sprite.textHeight = Math.max(1.5, node.val * 0.4);
      sprite.position.y = node.val + 2;
      sprite.fontFace = "'Rajdhani', sans-serif";
      group.add(sprite);

      return group;
    })
    
    // EVENTOS
    .onNodeClick(node => {
      Graph.controls().autoRotate = false; 
      document.getElementById('card-title').innerText = node.name;
      document.getElementById('card-id').innerText = node.id;
      document.getElementById('card-grado').innerText = node.grado || 0;
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
      actualizarFiltroVisual();
    })
    .onBackgroundClick(() => {
      document.getElementById('info-card').style.display = 'none';
      highlightNodes.clear(); highlightLinks.clear();
      actualizarFiltroVisual();
      setTimeout(() => { Graph.controls().autoRotate = true; }, 800);
    });

  Graph.d3Force('charge').strength(-150);

  // FILTRO BLOOM
  const bloomPass = new THREE.UnrealBloomPass();
  bloomPass.strength = 0.5;  
  bloomPass.radius = 0.2;    
  bloomPass.threshold = 0.1;  
  Graph.postProcessingComposer().addPass(bloomPass);

  const controls = Graph.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3; 
  controls.enableDamping = true;  
}

function actualizarFiltroVisual() {
  const hayFoco = highlightNodes.size > 0;
  Graph.graphData().nodes.forEach(node => {
    if (node.__threeObj) {
      const isWormhole = node.group === 'Wormhole';
      const extraGlow = Math.min((node.grado || 0) * 0.1, 0.5); 
      
      const enfocado = highlightNodes.has(node);
      const opacidadCristal = hayFoco ? (enfocado ? 0.9 : 0.05) : (isWormhole ? 0.2 : 0.4 + extraGlow);
      const opacidadTexto = hayFoco ? (enfocado ? 1.0 : 0.0) : 1.0;

      const group = node.__threeObj.children;
      if (group[0]) group[0].material.opacity = opacidadCristal;
      if (group[1]) group[1].material.opacity = opacidadTexto;
    }
  });
  
  Graph.linkColor(Graph.linkColor())
       .linkWidth(Graph.linkWidth())
       .linkDirectionalParticles(Graph.linkDirectionalParticles());
}

document.getElementById('btn-buscar').addEventListener('click', () => {
  const texto = document.getElementById('buscador').value.toLowerCase().trim();
  if (!texto || !Graph) return;
  const target = Graph.graphData().nodes.find(n => n.id.toLowerCase().includes(texto) || n.name.toLowerCase().includes(texto));
  if (target) {
    const ratio = 1 + 60 / target.val;
    Graph.cameraPosition({ x: target.x * ratio, y: target.y * ratio, z: target.z * ratio }, target, 1500);
  }
});
