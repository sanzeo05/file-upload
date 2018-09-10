'use strict';

const ws = 'https://neto-api.herokuapp.com';

const wrapForCanv = document.createElement('div');
const canvas = document.createElement('canvas');

let connection;
let getData; 
let showComments = {};
let currColor;

const currImg = document.querySelector('.current-image');
const loadImg = document.querySelector('.image-loader');
const wrapApp = document.querySelector('.app');
const formComment = document.querySelector('.comments__form').cloneNode(true);

let movedPiece = null;
let minY, minX, maxX, maxY;
let shiftX = 0;
let shiftY = 0;

let url = new URL(`${window.location.href}`);
let paramId = url.searchParams.get('id'); //ищем параметр 'id'

document.addEventListener('mousedown', dragElem);
document.addEventListener('mousemove', restriction(drag));
document.addEventListener('mouseup', drop);

setGlobalVar('error');
setGlobalVar('menu');
setGlobalVar('burger');

currImg.src = ''; 

getGlobalVar('menu').dataset.state = 'initial'; 
wrapApp.dataset.state = '';

hideElement(getGlobalVar('burger')); 

wrapApp.removeChild(document.querySelector('.comments__form')); 

getGlobalVar('menu').querySelector('.new').addEventListener('click', uploadDataFile); 

wrapApp.addEventListener('drop', eventFileDrop); 
wrapApp.addEventListener('dragover', event => event.preventDefault()); 

getGlobalVar('burger').addEventListener('click', showMenu); 

canvas.addEventListener('click', checkComment); 

document.querySelector('.menu__toggle-title_on').addEventListener('click', markCheckboxOn);
document.querySelector('#comments-on').addEventListener('click', markCheckboxOn); 

document.querySelector('.menu__toggle-title_off').addEventListener('click', markCheckboxOff);
document.querySelector('#comments-off').addEventListener('click', markCheckboxOff);

getGlobalVar('menu').querySelector('.menu_copy').addEventListener('click', replicate); 
checkurlId(paramId); 

Array.from(getGlobalVar('menu').querySelectorAll('.menu__color')).forEach(color => {
	if (color.checked) {  
		currColor = getComputedStyle(color.nextElementSibling).backgroundColor;  
	}
	color.addEventListener('click', (event) => { 
		currColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor; 
	});
});

const ctx = canvas.getContext('2d'); 
const BRUSH_RADIUS = 4; 
let curves = [];
let drawing = false;
let needsRepaint = false;

canvas.addEventListener("mousedown", (event) => {
	if (!(getGlobalVar('menu').querySelector('.draw').dataset.state === 'selected')) return;
	drawing = true;

	const curve = []; 
	curve.color = currColor;

	curve.push(makePoint(event.offsetX, event.offsetY)); 
	curves.push(curve); 
	needsRepaint = true;
});

canvas.addEventListener("mouseup", (event) => {
	getGlobalVar('menu').style.zIndex = '1';
	drawing = false;
});

canvas.addEventListener("mouseleave", (event) => {
	drawing = false;
});

canvas.addEventListener("mousemove", (event) => {
	if (drawing) {
		getGlobalVar('menu').style.zIndex = '0';
		curves[curves.length - 1].push(makePoint(event.offsetX, event.offsetY));
		needsRepaint = true;
		debounceSendMask();
	}
});

const debounceSendMask = debounce(sendMaskState, 1000);

tick();

window.addEventListener('beforeunload', () => { connection.close(); console.log('Веб-сокет закрыт') }); 

function getGlobalStorage() {
	if( typeof( window['globalStorage'] ) === 'undefined' ) {
		window.globalStorage = {};
	}

	return window.globalStorage;
}

function setGlobalVar(arg) {
	let storage = getGlobalStorage();

	storage[arg] = document.querySelector(`.${arg}`);
}

function getGlobalVar(arg) {
	let storage = getGlobalStorage();

	return storage[arg];
}

function replicate() {  
	getGlobalVar('menu').querySelector('.menu__url').select(); 
	try {
		let successful = document.execCommand('copy'); 
		let msg = successful ? 'успешно ' : 'не';  
		console.log(`URL ${msg} скопирован`);  
	} catch(err) {  
		console.log('Ошибка копирования');  
	}  
	window.getSelection().removeAllRanges();
}

function removePostfix(inputText) { 
	let regExp = new RegExp(/\.[^.]+$/gi);

	return inputText.replace(regExp, '');  
}

function dataTime(timestamp) {
	const options = {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	};
	const date = new Date(timestamp);
	const dateStr = date.toLocaleString('ru-RU', options);

	return dateStr.slice(0, 8) + dateStr.slice(9);
}

function hideErr() {
	setTimeout(function() {
		hideElement(getGlobalVar('error'))
	}, 7000);
}

function hideElement(el) {
	el.style.display = 'none';
}

function showElement(el) {
	el.style.display = '';
}

function dragElem(event) {
	if (!event.target.classList.contains('drag')) { return; }

	movedPiece = event.target.parentElement;
	minX = wrapApp.offsetLeft;
	minY = wrapApp.offsetTop;
		
	maxX = wrapApp.offsetLeft + wrapApp.offsetWidth - movedPiece.offsetWidth;
	maxY = wrapApp.offsetTop + wrapApp.offsetHeight - movedPiece.offsetHeight;
		
	shiftX = event.pageX - event.target.getBoundingClientRect().left - window.pageXOffset;
	shiftY = event.pageY - event.target.getBoundingClientRect().top - window.pageYOffset;
}

function drag(event) {
	if (!movedPiece) {return; }

	let x = event.pageX - shiftX;
	let y = event.pageY - shiftY;
	x = Math.min(x, maxX);
	y = Math.min(y, maxY);
	x = Math.max(x, minX);
	y = Math.max(y, minY);
	movedPiece.style.left = x + 'px';
	movedPiece.style.top = y + 'px';
}

function drop(evet) {
	if (movedPiece) {
		movedPiece = null;
	}
}

function restriction(func, delay = 0) {
	let isWaiting = false;
	
	return function (...res) {
		if (!isWaiting) {
			func.apply(this, res);	
			isWaiting = true;		
			setTimeout(() => {	
				isWaiting = false;
			}, delay);
		}
	}
}

function debounce(func, delay = 0) {
	let timeout;
	
	return () => {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			timeout = null;
			func();
		}, delay);
	};
}

function uploadDataFile(event) {
	hideElement(getGlobalVar('error'));
	//добавим форму для вызова окна "выбора файла"
	const input = document.createElement('input');
	input.setAttribute('id', 'fileInput');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', 'image/jpeg, image/png');
	hideElement(input);
	getGlobalVar('menu').appendChild(input);

	document.querySelector('#fileInput').addEventListener('change', event => {
		const files = Array.from(event.currentTarget.files);

		if (currImg.dataset.load === 'load') {
			removeForm();
			curves = []; 
		}

		transmitFile(files);
	});

	input.click();
	getGlobalVar('menu').removeChild(input);
}

function eventFileDrop(event) {
	event.preventDefault();
	hideElement(getGlobalVar('error'));
	const files = Array.from(event.dataTransfer.files);
	
	if (currImg.dataset.load === 'load') {
		showElement(getGlobalVar('error'));
		getGlobalVar('error').lastElementChild.textContent = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';
		hideErr();
		return;
	}

	files.forEach(file => {
		if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
			transmitFile(files);
		} else {
			showElement(getGlobalVar('error'))
		}
	});
}

function transmitFile(files) {
	const formData = new FormData();
	
	files.forEach(file => {
		const fileTitle = removePostfix(file.name);
		formData.append('title', fileTitle);
		formData.append('image', file);
	});

	showElement(loadImg);

	fetch(`${ws}/pic`, {
			body: formData,
			credentials: 'same-origin',
			method: 'POST'
		})
		.then( res => {
			if (res.status >= 200 && res.status < 300) {
				return res;
			}
			throw new Error (res.statusText);
		})
		.then(res => res.json())
		.then(res => {
			getFileInfo(res.id);
		})
		.catch(er => {
			console.log(er);
			hideElement(loadImg);
		});
}

function removeForm() {
	const formComment = wrapApp.querySelectorAll('.comments__form');
	Array.from(formComment).forEach(item => {item.remove()});
}

function getFileInfo(id) {
	const xhrGetInfo = new XMLHttpRequest();
	xhrGetInfo.open(
		'GET',
		`${ws}/pic/${id}`,
		false
	);
	xhrGetInfo.send();

	getData = JSON.parse(xhrGetInfo.responseText);
	localStorage.host = `${window.location.origin}${window.location.pathname}?id=${getData.id}`;
	wss();	
	addBackground(getData);
	getGlobalVar('burger').style.cssText = ``;
	showMenu();

	currImg.addEventListener('load', () => {
		hideElement(loadImg);
		addWrapforCanvsComm();
		createCanvas();
		currImg.dataset.load = 'load';
	});

	updCommsForm(getData.comments);
}

function showMenu() {
	getGlobalVar('menu').dataset.state = 'default';

	Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
		modeItem.dataset.state = '';
		modeItem.addEventListener('click', () => {
			
			if (!modeItem.classList.contains('new')){
				getGlobalVar('menu').dataset.state = 'selected';
				modeItem.dataset.state = 'selected';
			}
			
			if (modeItem.classList.contains('share')) {
				getGlobalVar('menu').querySelector('.menu__url').value = localStorage.host;
			}
		})
	})
}

function revealComments() {
	getGlobalVar('menu').dataset.state = 'default';

	Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
		if (!modeItem.classList.contains('comments')) { return; }
			
		getGlobalVar('menu').dataset.state = 'selected';
		modeItem.dataset.state = 'selected';
	})
}

function addBackground(fileInfo) {
	currImg.src = fileInfo.url;
}

function markCheckboxOff() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = 'none';
	 })
}

function markCheckboxOn() {
	const forms = document.querySelectorAll('.comments__form');
	Array.from(forms).forEach(form => {
		form.style.display = '';
	})
}

function checkComment(event) {
	if (!(getGlobalVar('menu').querySelector('.comments').dataset.state === 'selected') || !wrapApp.querySelector('#comments-on').checked) { return; }
	wrapForCanv.appendChild(addCommentForm(event.offsetX, event.offsetY));
}

function createCanvas() {
	const width = getComputedStyle(wrapApp.querySelector('.current-image')).width.slice(0, -2);
	const height = getComputedStyle(wrapApp.querySelector('.current-image')).height.slice(0, -2);
	canvas.width = width;
	canvas.height = height;

	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.display = 'block';
	canvas.style.zIndex = '1';

	wrapForCanv.appendChild(canvas);
}

function addWrapforCanvsComm() {
	const width = getComputedStyle(wrapApp.querySelector('.current-image')).width;
	const height = getComputedStyle(wrapApp.querySelector('.current-image')).height;
	wrapForCanv.style.cssText = `
		width: ${width};
		height: ${height};
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: block;
	`;
	wrapApp.appendChild(wrapForCanv);

	wrapForCanv.addEventListener('click', event => {
		if (event.target.closest('form.comments__form')) {
			Array.from(wrapForCanv.querySelectorAll('form.comments__form')).forEach(form => {
				form.style.zIndex = 2;
			});
			event.target.closest('form.comments__form').style.zIndex = 3;
		}
	});
}

function addCommentForm(x, y) {
	
	const left = x - 22;
	const top = y - 14;

	formComment.style.cssText = `
		top: ${top}px;
		left: ${left}px;
		z-index: 2;
	`;
	formComment.dataset.left = left;
	formComment.dataset.top = top;

	hideElement(formComment.querySelector('.loader').parentElement);

	formComment.querySelector('.comments__close').addEventListener('click', () => {
		formComment.querySelector('.comments__marker-checkbox').checked = false;
	});

	formComment.addEventListener('submit', sendMsgs);
	formComment.querySelector('.comments__input').addEventListener('keydown', keySendMessage);

	function keySendMessage(event) {
		if (event.repeat) { return; }
		if (!event.ctrlKey) { return; }

		switch (event.code) {
			case 'Enter':
				sendMsgs();
			break;
		}
	}

	function sendMsgs(event) {
		if (event) {
			event.preventDefault();
		}
		const message = formComment.querySelector('.comments__input').value;
		const messageSend = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
		commentsSend(messageSend);
		showElement(formComment.querySelector('.loader').parentElement);
		formComment.querySelector('.comments__input').value = '';
	}

	function commentsSend(message) {
		fetch(`${ws}/pic/${getData.id}/comments`, {
				method: 'POST',
				body: message,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
			})
			
			.then(res => res.json())
			.catch(er => {
				console.log(er);
				formComment.querySelector('.loader').parentElement.style.display = 'none';
			});
	}
	
	return formComment;
}

function addMessageComment(message, form) {
	let parentLoaderDiv = form.querySelector('.loader').parentElement;

	const newMessageDiv = document.createElement('div');
	newMessageDiv.classList.add('comment');
	newMessageDiv.dataset.timestamp = message.timestamp;
		
	const commentTimeP = document.createElement('p');
	commentTimeP.classList.add('comment__time');
	commentTimeP.textContent = dataTime(message.timestamp);
	newMessageDiv.appendChild(commentTimeP);

	const commentMessageP = document.createElement('p');
	commentMessageP.classList.add('comment__message');
	commentMessageP.textContent = message.message;
	newMessageDiv.appendChild(commentMessageP);

	form.querySelector('.comments__body').insertBefore(newMessageDiv, parentLoaderDiv);
}

function updCommsForm(newComment) {
	if (!newComment) return;
	Object.keys(newComment).forEach(id => {
		if (id in showComments) return;
			
		showComments[id] = newComment[id];
		let needCreateNewForm = true;

		Array.from(wrapApp.querySelectorAll('.comments__form')).forEach(form => {
			
			if (+form.dataset.left === showComments[id].left && +form.dataset.top === showComments[id].top) {
				form.querySelector('.loader').parentElement.style.display = 'none';
				addMessageComment(newComment[id], form); 
				needCreateNewForm = false;
			}
		});

		if (needCreateNewForm) {
			const newForm = addCommentForm(newComment[id].left + 22, newComment[id].top + 14);
			newForm.dataset.left = newComment[id].left;
			newForm.dataset.top = newComment[id].top;
			newForm.style.left = newComment[id].left + 'px';
			newForm.style.top = newComment[id].top + 'px';
			wrapForCanv.appendChild(newForm);
			addMessageComment(newComment[id], newForm);
			if (!wrapApp.querySelector('#comments-on').checked) {
				newForm.style.display = 'none';
			}
		}
	});
}

function insertWssCommentForm(wssComment) {
	const wsCommentEdited = {};
	wsCommentEdited[wssComment.id] = {};
	wsCommentEdited[wssComment.id].left = wssComment.left;
	wsCommentEdited[wssComment.id].message = wssComment.message;
	wsCommentEdited[wssComment.id].timestamp = wssComment.timestamp;
	wsCommentEdited[wssComment.id].top = wssComment.top;
	updCommsForm(wsCommentEdited);
}

function wss() {
	connection = new WebSocket(`wss://neto-api.herokuapp.com/pic/${getData.id}`);
	connection.addEventListener('message', event => {
		if (JSON.parse(event.data).event === 'pic'){
			if (JSON.parse(event.data).pic.mask) {
				canvas.style.background = `url(${JSON.parse(event.data).pic.mask})`;
			} else {
				canvas.style.background = ``;
			}
		}

		if (JSON.parse(event.data).event === 'comment'){
			insertWssCommentForm(JSON.parse(event.data).comment);
		}

		if (JSON.parse(event.data).event === 'mask'){
			canvas.style.background = `url(${JSON.parse(event.data).url})`;
		}
	});
}

function checkurlId(id) {
	if (!id) { return;	}
	getFileInfo(id);
	revealComments();
}

function circle(point) {
	ctx.beginPath();
	ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
	ctx.fill();
}

function smoothCurveBetween (p1, p2) {
	const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
	ctx.quadraticCurveTo(...p1, ...cp);
}

function smoothCurve(points) {
	ctx.beginPath();
	ctx.lineWidth = BRUSH_RADIUS;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	ctx.moveTo(...points[0]);

	for(let i = 1; i < points.length - 1; i++) {
		smoothCurveBetween(points[i], points[i + 1]);
	}

	ctx.stroke();
}

function makePoint(x, y) {
	return [x, y];
}

function redrawing () {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	curves.forEach((curve) => {
		ctx.strokeStyle = curve.color;
		ctx.fillStyle = curve.color;
	
		circle(curve[0]);
		smoothCurve(curve);

	});
}

function sendMaskState() {
	canvas.toBlob(function (blob) {
		connection.send(blob);
		console.log(connection);
	});
}

function tick () {
  
	if (getGlobalVar('menu').offsetHeight > 66) {
		getGlobalVar('menu').style.left = (wrapApp.offsetWidth - getGlobalVar('menu').offsetWidth) - 10 + 'px';
	}

	if(needsRepaint) {
		redrawing();
		needsRepaint = false;
	}

	window.requestAnimationFrame(tick);
}