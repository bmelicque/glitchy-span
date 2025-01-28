import * as THREE from "three";

const ANIMATION_CONFIG = {
	glitchIntensityMod: 0.5,
};

const VERTEX_SHADER = `
    varying vec2 vUv;
    void main() {
       vUv = uv;
       gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
`;

const FRAGMENT_SHADER = `
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D tDiffuse;
uniform float glitchIntensity;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec4 baseState = texture2D(tDiffuse, uv);
      
    if (glitchIntensity <= 0.) {
        gl_FragColor = baseState; 
        return;
    }

    float segment = floor(uv.y * 8.0); 
    float randomValue = fract(sin(segment * 1000. + glitchIntensity) * 1000.); 
    vec2 offset = vec2(randomValue * 0.03, 0.0) * glitchIntensity;

    vec4 redGlitch = texture2D(tDiffuse, uv + offset);
    vec4 greenGlitch = texture2D(tDiffuse, uv - offset);
    vec4 blueGlitch = texture2D(tDiffuse, uv);
    
    float m = mod(segment, 3.0);

    float alpha;
    if (m == 0.0) {
        // alpha = (redGlich.a + greenGlitch.a + baseState.a) / 3.0;
        gl_FragColor = vec4(redGlitch.r, greenGlitch.g, baseState.b, redGlitch.a + greenGlitch.a);
    } else if (m == 1.0) {
        gl_FragColor = vec4(baseState.r, greenGlitch.g, blueGlitch.b, baseState.a + greenGlitch.a);
    } else {
        gl_FragColor = vec4(redGlitch.r, baseState.g, blueGlitch.b, redGlitch.a + baseState.a);
    }
}
`;

export class GlitchySpan extends HTMLElement {
	constructor() {
		super();

		const text = this.getAttribute("text") ?? "";

		const shadow = this.attachShadow({ mode: "open" });
		const wrapper = document.createElement("span");
		wrapper.style.display = "inline-block";
		wrapper.style.position = "relative";
		shadow.appendChild(wrapper);

		const textElement = document.createElement("span") as HTMLSpanElement;
		wrapper.appendChild(textElement);
		textElement.innerText = text;
		textElement.style.visibility = "hidden";

		const textCanvas = makeTextCanvas(wrapper);
		writeText(textCanvas, textElement, text);

		const { scene, camera, renderer, planeMesh } = makeScene(wrapper, textCanvas);
		const updateIntensity = (value: number) => {
			planeMesh.material.uniforms.glitchIntensity.value = value;
		};
		const render = () => renderer.render(scene, camera);
		setupAnimation(wrapper, updateIntensity, render);

		wrapper.addEventListener("mouseover", () => {
			writeText(textCanvas, textElement, text);
			updateMesh(planeMesh, textCanvas);
		});
		wrapper.addEventListener("mouseleave", () => {
			writeText(textCanvas, textElement, text);
			updateMesh(planeMesh, textCanvas);
		});
		wrapper.appendChild(renderer.domElement);
	}
}

function makeTextCanvas(wrapper: HTMLSpanElement) {
	const textCanvas = document.createElement("canvas") as HTMLCanvasElement;
	textCanvas.height = wrapper.offsetHeight;
	textCanvas.width = wrapper.offsetWidth;
	textCanvas.style.position = "absolute";
	textCanvas.style.top = "0";
	textCanvas.style.left = "0";
	return textCanvas;
}

function writeText(textCanvas: HTMLCanvasElement, textElement: HTMLSpanElement, text: string) {
	const context = textCanvas.getContext("2d")!;
	const { fontWeight, fontSize, fontFamily, color } = getComputedStyle(textElement);
	context.fillStyle = color;
	context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, textCanvas.width / 2, textCanvas.height / 2);
}

function makeScene(wrapper: HTMLElement, textCanvas: HTMLCanvasElement) {
	const aspectRatio = wrapper.offsetWidth / wrapper.offsetHeight;
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(90, aspectRatio, 0.01, 10);
	camera.position.z = 1;
	const texture = new THREE.CanvasTexture(textCanvas);
	const shaderUniforms = {
		tDiffuse: { value: texture },
		glitchIntensity: { value: 0.0 },
	};
	const planeMesh = new THREE.Mesh(
		new THREE.PlaneGeometry(2 * aspectRatio, 2),
		new THREE.ShaderMaterial({
			uniforms: shaderUniforms,
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			transparent: true,
		})
	);
	scene.add(planeMesh);
	const renderer = new THREE.WebGLRenderer({ alpha: true });
	renderer.setSize(wrapper.offsetWidth, wrapper.offsetHeight);
	renderer.domElement.style.position = "absolute";
	renderer.domElement.style.top = "0";
	renderer.domElement.style.left = "0";
	return { scene, camera, renderer, planeMesh };
}

function setupAnimation(wrapper: HTMLElement, updateIntensity: (value: number) => void, render: () => void) {
	let isHovered = false;
	let frames = 0;
	let hoverDuration = 0;
	let lastFrame = performance.now();

	wrapper.addEventListener("mouseover", function () {
		if (!isHovered) frames = 0;
		isHovered = true;
	});
	wrapper.addEventListener("mouseout", function () {
		isHovered = false;
		updateIntensity(0);
	});

	function animateScene() {
		requestAnimationFrame(animateScene);

		if (isHovered && frames < 7) {
			hoverDuration += performance.now() - lastFrame;

			if (hoverDuration >= 50) {
				// ~5frames
				frames++;
				hoverDuration = 0;
				updateIntensity(frames < 5 ? (Math.random() + 1) * ANIMATION_CONFIG.glitchIntensityMod : 0);
			}
		}

		lastFrame = performance.now();
		render();
	}
	animateScene();
}

function updateMesh(mesh: THREE.Mesh, texture: HTMLCanvasElement) {
	const material = mesh.material as THREE.ShaderMaterial;
	material.uniforms.tDiffuse.value = new THREE.CanvasTexture(texture);
}
