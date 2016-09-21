/**
 * Created by danding on 16/8/20.
 */
var express = require('express');
var app = require('express')();
var server=require('http').createServer();
var WebSocketServer=require('ws').Server;
var wss = new WebSocketServer({server: server});
var svrProc = require('./js/svrProc');

var static = require("express-static");
var bodyParser=require('body-parser');
var httpProxy = require("http-proxy");
var proxy = httpProxy.createProxyServer({});
var colors=require('colors');
var ulr = require('url');
var fs=require('fs');
//var formidable = require('formidable');

app.enable('trust proxy');


app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(static(__dirname + '/www'));



app.get('/',function(req,res) {
    res.sendFile(__dirname+'/www/index.html');
});

app.post('*',function(req,res,next) {
   req.user={
       id:2
   }
    next();
});

app.post('/login', function (req, res) {

    res.send({re: 1});
});

app.post('/proxy/node_server/login',function(req,res) {
    var info=req.body;
    res.send({re: 1});
});


app.post('/**/svr/request', svrProc);


wss.on('connection',function connection(ws) {
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
    });
    ws.send('something');
});

server.on('request', app);
server.listen(9040);

