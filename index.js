const {app, BrowserWindow} = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');
const Buffer = require('buffer').Buffer;

const store=new Store();
var appDataPath;
var jsonFin;
var win;
var slider;
var lastFrame;
var ready=false;

if (app !== undefined) {
    app.on('ready', function () {
        win = new BrowserWindow({
            webPreferences: {
                nodeIntegration: true
            }
        });
        win.loadURL(`file://${__dirname}/index.html`);
    });
	appDataPath=app.getPath('appData');
	store.set('appdata',appDataPath);
}

function makeBackslash(id){
	let checked=document.getElementById(id);
	let val=checked.value;
	for(let i=0;i<val.length;i++){
		if(val.charAt(i)=='\\'&&val.charAt(i-1)!='\\'&&val.charAt(i+1)!='\\'){
			checked.value=val.substring(0,i)+"\\\\"+val.substring(i+1);
		} 
	}
}

function makeBackString(str){
	checked=str;
	let i=0;
	for(i=0;i<checked.length;i++){
		if(checked.charAt(i)=='\\'&&checked.charAt(i-1)!='\\'&&checked.charAt(i+1)!='\\'){
			checked=checked.substring(0,i)+"\\\\"+checked.substring(i+1);
		} 
	}
	return checked;
}

function init(){
	appDataPath=store.get('appdata');
	main();
	if(store.get('output')==""||store.get('output')==undefined){
		forceSettings();
	}
	else{
		document.getElementById("outputFolder").value=store.get('output');
	}
	if(store.get('iso')==""||store.get('iso')==undefined){
		forceSettings();
	}
	else{
		document.getElementById("isoPath").value=store.get('iso');
	}
	if(store.get('watchReload')==true){
		watchScreen();
		store.delete('watchReload');
	}
	
	if(store.get('fileSaved')!=undefined&&store.get('fileSaved')!=""){
		genScreen();
		document.getElementById('fileName').innerHTML=store.get('fileSaved');
		document.getElementById("fileWrite").hidden=false;
		document.getElementById("firstGen").hidden=true;
		store.delete('fileSaved');
	}
}

function updatePath(){
	makeBackslash("outputFolder");
	store.set('output',document.getElementById("outputFolder").value);
}

function forceSettings(){
	document.getElementById("mainApp").hidden=true;
	document.getElementById("settings").hidden=false;
	document.getElementById("navBar").hidden=false;
}

function main(){
	document.getElementById("mainApp").hidden=false;
	document.getElementById("init").hidden=false;
	document.getElementById("settings").hidden=true;
	document.getElementById("generator").hidden=true;
	document.getElementById("viewer").hidden=true;
	document.getElementById("navBar").hidden=true;
}

function genScreen(){
	main();
	document.getElementById("init").hidden=true;
	document.getElementById("generator").hidden=false;
	document.getElementById("navBar").hidden=false;
}

function watchScreen(){
	main();
	document.getElementById("init").hidden=true;
	document.getElementById("viewer").hidden=false;
	document.getElementById("navBar").hidden=false;
}

function regen(){
	document.getElementById("regenButton").click();
	document.getElementById("fileWrite").hidden=true;
	document.getElementById("firstGen").hidden=false;
	document.getElementById("navBar").hidden=false;
}

function generate(){
	let file=document.getElementById("slpIn").files[0];
	let startFrame=minSecToSec(document.getElementById("start").value);
	let endFrame=minSecToSec(document.getElementById("end").value);
	let sclp=store.get('output')+"/"+file.name;
	startFrame*=60;
	endFrame*=60;
	startFrame=28800-startFrame;
	endFrame=28800-endFrame;
	startFrame+="";
	endFrame+="";
	startFrame=Buffer.from(startFrame).toString('hex');
	endFrame=Buffer.from(endFrame).toString('hex');
	let addData="7B7B5507636C6970535507747275655507636C69705374617274535507"+startFrame+"5507636C6970456E64535507"+endFrame+"7d7d";
	store.set('fileSaved',file.name.substring(0,file.name.length-2)+"clp");
	document.getElementById('fileName').innerHTML="Wrote File "+file.name.substring(0,file.name.length-2)+"clp";
	document.getElementById("fileWrite").hidden=false;
	document.getElementById("firstGen").hidden=true;
	fs.copyFileSync(file.path,sclp);
	fs.appendFileSync(sclp, addData, 'hex');
	fs.renameSync(sclp, store.get('output')+"/"+file.name.substring(0,file.name.length-2)+"clp");
}

function minSecToSec(min){
	let arr=min.split(':');
	let seconds;
	seconds=parseInt(arr[0]);
	seconds*=60;
	seconds+=parseInt(arr[1]);
	return seconds;
}

function playback(){
	let json={};
	json.outputOverlayFiles=false;
	json.isRealTimeMode=false;
	json.commandId="0";
	let fileList=document.getElementById("sclp").files;
	if(fileList.length==1){
		json.mode="normal";
		json=normal(json,fileList);
	}
	else{
		json.mode="queue";
		json=queue(json,fileList);
	}
	jsonFin=json;
	fs.writeFile(path.join(appDataPath, 'slippi-clips', 'temp.json'), JSON.stringify(json), 'utf8', (err) => {
		loadFile();
	});
	store.set('watchReload',true);
	location=location;
}

function normal(json,fileList){
	let data=getData(fileList[0].path);
	json.replay=fileList[0].path;
	json.startFrame=data[0];
	json.endFrame=data[1];
	return json;
}

function queue(json, fileList){
	let queue=[];
	for(let i of fileList){
		let obj={};
		let data=getData(i.path);
		obj.path=i.path;
		obj.startFrame=data[0];
		obj.endFrame=data[1];
		obj.gameStartAt="";
		obj.gameStation="";
		queue.push(obj);
	}
	json.queue=queue;
	return json;
}

function getData(path){
	jsonFin="";
	let file=fs.readFileSync(path, 'utf8');
	while(file==undefined||file==""){
	}
	let frames=[2];
	file=file.substring(file.indexOf("{{UclipSUtrueUclipStartSU"));
	file=file.substring(2,file.indexOf("}"));
	frames[0]=parseInt(file.substring(file.indexOf("UclipStartSU")+14,file.indexOf("UclipEndSU")));
	frames[1]=parseInt(file.substring(file.indexOf("UclipEndSU")+12));
	return frames;
}

function updateIso(){
	makeBackslash("isoPath");
	store.set('iso',document.getElementById("isoPath").value);
}

function loadFile(){
	let dolphinPath=makeBackString(path.join(appDataPath, "Slippi Desktop App", "dolphin", "Dolphin.exe"));
	let jsonPath=makeBackString(path.join(appDataPath, 'slippi-clips', 'temp.json'));
	exec("\""+dolphinPath+"\" -i "+jsonPath+" -e \""+store.get('iso')+"\"");
}

function genJson(){
	let clippi=fs.readFileSync(document.getElementById("clippi").files[0].path);
	while(clippi==""||clippi==undefined){
	}
	clippi=JSON.parse(clippi);
	for(let i of clippi.queue){
		let startFrame=i.startFrame;
		let endFrame=i.endFrame;
		let name=i.path.substring(i.path.lastIndexOf('\\'));
		name=name.substring(1);
		let sclp=store.get('output')+"/"+name;
		startFrame+="";
		endFrame+="";
		startFrame=Buffer.from(startFrame).toString('hex');
		endFrame=Buffer.from(endFrame).toString('hex');
		let addData="7B7B5507636C6970535507747275655507636C69705374617274535507"+startFrame+"5507636C6970456E64535507"+endFrame+"7d7d";
		fs.copyFileSync(i.path,sclp);
		fs.appendFileSync(sclp, addData, 'hex');
		fs.renameSync(sclp, store.get('output')+"/"+name.substring(0,name.length-2)+"clp");
	}
	document.getElementById('fileName').innerHTML="Wrote "+clippi.queue.length+" files";
	document.getElementById("fileWrite").hidden=false;
	document.getElementById("firstGen").hidden=true;
}

function updateFileName(id1,id2){
	document.getElementById(id2).innerHTML=document.getElementById(id1).files[0].name;
	if(id1=='slpIn'){
		document.getElementById("times").hidden=false;
	}
	//loadGenFile();
}

/*function loadGenFile(){
	let data=fs.readFileSync(document.getElementById("slpIn").files[0].path, 'hex').toUpperCase();
	while(data==undefined){}
	let index1=data.indexOf("55096C6173744672616D656C")+24;
	let returnData="";
	for(let i=index1;i<index1+8;i++){
		returnData+=data.charAt(i);
	}
	readyGen(returnData);
	showSlide();
}

function readyGen(data){
	lastFrame=parseInt(data,16);
	ready=true;
}

function showSlide(){
	document.getElementById("times").hidden=false;
}

function framesToTime(frames){
	frames+=123;
	let seconds=Math.floor(frames/60);
	let minutes=Math.floor(seconds/60);
	return ""+minutes+":"+seconds;
}
*/