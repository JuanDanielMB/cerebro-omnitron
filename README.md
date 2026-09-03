# 🧠 Cerebro Digital - Protocolo Omnitron

![GitHub Pages](https://img.shields.io/badge/Despliegue-GitHub_Pages-success?style=for-the-badge&logo=github)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)
![Google Apps Script](https://img.shields.io/badge/API-Google_Apps_Script-blue?style=for-the-badge&logo=google)

**Visualizador Topológico 3D de Ontología Axiomática.** 
Este proyecto transforma una matriz de datos relacionales alojada en Google Sheets en una red neuronal interactiva y cinemática en 3D, utilizando renderizado WebGL y shaders de luz dinámica.

---

## 🌌 Visión General

El **Cerebro Digital** es una herramienta de visualización de grafos diseñada para mapear conceptos, axiomas y asignaturas (ej. Economía, Análisis Matemático, Ciencias Computacionales) y sus interconexiones. 

El sistema abandona las interfaces gráficas pesadas tradicionales en favor de un entorno inmersivo de alto rendimiento, donde los nodos de información flotan en un espacio tridimensional con estéticas de neón puro (ciberpunk) e interacciones orbitales suavizadas.

## ✨ Características Principales

* **Renderizado WebGL de Alto Rendimiento:** Construido sobre la geometría nativa de `3d-force-graph` y `Three.js`, optimizado para renderizar miles de partículas y nodos sin pérdida de cuadros (FPS).
* **Físicas Nativas Vectoriales (`d3-force-3d`):** El motor calcula la repulsión estática, estabilizando la red en una constelación densa que evita el solapamiento de nodos sin movimiento residual errático.
* **Iluminación Dinámica Ciberpunk (Shaders):** Integración de post-procesamiento con `UnrealBloomPass` para generar un resplandor de luz neón realista alrededor de la geometría pura, evitando materiales pesados.
* **Algoritmo de Ruta Más Corta (BFS):** Al enfocar un nodo periférico, el sistema calcula matemáticamente y resalta el "cordón umbilical" exacto a través de la topología hasta llegar al núcleo del sistema (`Omni-Eco`).
* **Cámara Cinemática Inercial:** Sistema de control orbital con amortiguación (*damping*) que permite un vuelo espacial suave y automatizado alrededor del grafo.

---

## 🛠️ Arquitectura y Stack Tecnológico

El proyecto utiliza una arquitectura descentralizada (*Decoupled Architecture*):

1. **Backend / Base de Datos (Google Sheets + Apps Script):** 
   La lógica de extracción de topología (nodos, aristas, grados de conexión) se procesa en la nube de Google. Un script expone la función `doGet(e)` convirtiendo el documento en una API REST pública.
2. **Frontend (GitHub Pages):**
   Capa de presentación estática compuesta por HTML5, CSS3 y JavaScript puro (Vanilla JS), libre de frameworks pesados, asegurando tiempos de carga ultrarrápidos.

**Librerías Core:**
* [Three.js](https://threejs.org/) (Renderizado 3D y Shaders)
* [3d-force-graph](https://github.com/vasturiano/3d-force-graph) (Motor visual topológico)
* [D3.js](https://d3js.org/) (Escalas matemáticas)

---

## 🚀 Despliegue y Sincronización

La aplicación está desplegada en vivo mediante **GitHub Pages**. 
Cualquier modificación realizada en la matriz principal de Google Sheets se refleja en tiempo real en la visualización web 3D una vez recargada la página, gracias al puente directo de la API.

🔗 **Visualizador en vivo:** [https://juandanielmb.github.io/cerebro-omnitron/](https://juandanielmb.github.io/cerebro-omnitron/)

---

## 👨‍💻 Autor

**Juan Daniel Muñoz Barrero**
*Desarrollo centrado en ciencias computacionales, ciencia de datos y modelado económico.*
