(function (){
	const CANVAS_HEIGHT = 1920;
	const CANVAS_WIDTH = 1920;
	const CENTER_X = CANVAS_WIDTH / 2;
	const CENTER_Y = CANVAS_HEIGHT / 2;
	const STRING_LENGTH = 20000;
	// Number of line segments used to approximate curve between points
	const INTERPOLATION_DENSITY = 5;
	// Number of points to use for polynomial interpolation
	const INTERPOLATION_POINTS = 4;
	const MAX_COLORS = 10;

	window.onload = start;

	function start() {
		document.getElementById('start').onclick = renderDrawing;
	}

	function renderDrawing() {
		const canvas = document.getElementById('drawing');
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		const r0 = getFloat('r');
		const omega0 = getFloat('omega');
		const v0 = getFloat('v');

		const environment = {
			gravity: getFloat('g'),
			timeStep: 1 - getFloat('resolution'),
			finalTime: getFloat('time'),
			context: ctx,
			colorSpeed: getFloat('color-speed'),
			colorRadius: getFloat('color-radius'),
			colorWidth: getFloat('color-width'),
			numColors: getFloat('num-colors'),
			colors: [],
		}

		for (let i = 0; i < MAX_COLORS; i++) {
			environment.colors[i] = document.getElementById("color" + (i + 1)).value;
		}

		if (r0 > STRING_LENGTH) {
			alert('Starting point outside possible range for string');
			return;
		}

		// Both phi and omega are vectors of the form [position, angular velocity]
		const phi = new Vector(
			Math.asin(r0 / STRING_LENGTH),
			0,
		);

		const omega = new Vector(
			omega0,
			v0 / Math.abs(r0),
		);

		ctx.lineWidth = environment.colorWidth;
		ctx.lineJoin = "round";
		window.requestAnimationFrame(
			createAnimationFrame(phi, omega, 0, environment)
		);
	}

	function createAnimationFrame(phi, omega, time, environment) {
		return function (timestamp) {
			animateFrame(phi, omega, time, environment);
		}
	}

	function animateFrame(phi, omega, time, environment) {
		let colorLines = [];

		for (let i= 0; i < INTERPOLATION_POINTS; i++) {
			const centerPoint = sphericalToCartesian(phi[0], omega[0]);

			for (let c = 0; c < environment.numColors; c++) {
				const offset = 2 * Math.PI * c / environment.numColors;
				const delta = time + i * environment.timeStep;
				const theta = environment.colorSpeed * delta + offset;

				if (colorLines[c] == undefined) {
					colorLines[c] = [];
				}

				colorLines[c].push(new Vector(
					centerPoint[0] + environment.colorRadius * Math.cos(theta),
					centerPoint[1] + environment.colorRadius * Math.sin(theta),
				));
			}

			if (i < INTERPOLATION_POINTS - 1) {
				phi = stepPendulum(phi, environment);
				omega[0] = omega[0] + environment.timeStep * omega[1];
			}
		}

		let interpolatedLines = [];
		for (let c = 0; c < environment.numColors; c++) {
			interpolatedLines[c] = interpolatePoints(colorLines[c]);
		}

		const ctx = environment.context;
		for (let i = 0; i < interpolatedLines[0].length - 2; i++) {
			for (let c = 0; c < environment.numColors; c++) {
				const firstPoint = interpolatedLines[c][i];
				const middlePoint = interpolatedLines[c][i + 1];
				const lastPoint = interpolatedLines[c][i + 2];

				ctx.strokeStyle = environment.colors[c];
				ctx.beginPath();
				ctx.moveTo(firstPoint[0], firstPoint[1]);
				ctx.lineTo(middlePoint[0], middlePoint[1]);
				ctx.lineTo(lastPoint[0], lastPoint[1]);
				ctx.stroke();
			}	
		}
		

		if (time < environment.finalTime) {
			const newTime = time + environment.timeStep * (INTERPOLATION_POINTS - 1);
			window.requestAnimationFrame(
				createAnimationFrame(phi, omega, newTime, environment)
			);
		}
	}

	function interpolatePoints(points) {
		// P(t) = c3 t^3 + c2 t^2 + c1 t + c0
		// Where P(0) = p0, P(1) = p1, P(2) = p2, and P(3) = p3
		const c0 = points[0];

		const c1 = points[0].mul(-11/6)
			    	.add(points[1].mul(3))
			    	.add(points[2].mul(-3/2))
			    	.add(points[3].mul(1/3));

		const c2 = points[0]
					.add(points[1].mul(-5/2))
					.add(points[2].mul(2))
					.add(points[3].mul(-1/2));

		const c3 = points[0].mul(-1/6)
					.add(points[1].mul(1/2))
					.add(points[2].mul(-1/2))
					.add(points[3].mul(1/6));

		let interpolatedPoints = [];

		for (let i = 1; i < (INTERPOLATION_POINTS - 1/2) * INTERPOLATION_DENSITY; i++) {
			const t = i / INTERPOLATION_DENSITY;

			const currPoint = c0
								.add(c1.mul(t))
								.add(c2.mul(t * t))
								.add(c3.mul(Math.pow(t, 3)));

			interpolatedPoints.push(currPoint);
		}

		return interpolatedPoints;
	}

	function stepPendulum(phi, environment) {
		let dt = environment.timeStep;

		let k1 = new Vector(
			dt * phi[1], 
			calculateAcceleration(phi[0], environment),
		);

		let k2 = new Vector(
			dt * (phi[1] + k1[1] / 2),
			calculateAcceleration(phi[0] + k1[0] / 2, environment),
		);

		let k3 = new Vector(
			dt * (phi[1] + k2[1] / 2),
			calculateAcceleration(phi[0] + k2[0] / 2, environment),
		);

		let k4 = new Vector(
			dt * (phi[1] + k3[1]),
			calculateAcceleration(phi[0] + k3[0], environment),
		);

		return phi.add(
				k1.add(k2.mul(2))
				  .add(k3.mul(2))
				  .add(k4)
				  .mul(1/6)
				);
	}

	function calculateAcceleration(angle, environment) {
		return -1 * environment.gravity / STRING_LENGTH * Math.sin(angle);
	}

	function getFloat(fieldName) {
		return parseFloat(document.getElementById(fieldName).value);
	}

	function sphericalToCartesian() {
		let phi, omega;
		if (arguments.length == 1) {
			phi = arguments[0][0];
			omega = arguments[0][1];
		} else {
			phi = arguments[0];
			omega = arguments[1];
		}

		const r = STRING_LENGTH * Math.sin(phi);
		return (new Vector(
			r * Math.cos(omega) + CENTER_X,
			r * Math.sin(omega) + CENTER_Y,
		));
	}

	function Vector() {
		if (arguments.length == 1 && arguments[0] instanceof Vector) {
			arguments = arguments[0];
		}

		this.length = arguments.length;
		for (let i = 0; i < this.length; i++) {
			this[i] = arguments[i];
		}

		this.add = Vector_add;
		this.mul = Vector_mul;
	}

	function Vector_add(other) {
		if (!(other instanceof Vector)) {
			throw JSON.toString(other) + ' is not a Vector';
		} else if (other.length != this.length) {
			throw 'Dimension mismatch on Vector addition';
		}

		let ret = new Vector(other);
		for (let i = 0; i < this.length; i++) {
			ret[i] += this[i];
		}

		return ret;
	}

	function Vector_mul(scalar) {
		if (typeof scalar !== 'number') {
			throw JSON.toString(scalar) + ' is not a scalar';
		}

		let ret = new Vector(this);
		for (let i = 0; i < this.length; i++) {
			ret[i] *= scalar;
		}

		return ret;
	}

	function mod(num, base) {
		const res = num % base;
		if (res < 0) {
			return res + base;
		}

		return res;
	}
})();