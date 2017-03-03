$(
    function initMap() {
        map = new google.maps.Map(document.getElementById('Location-map'), {
        center: {lat: 24.7867056, lng: 120.9959000},
        zoom: 16});
    }  
);

$(function () {
    var pinColor = "ffffff";
        var pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + pinColor,
            new google.maps.Size(21, 34),
            new google.maps.Point(0,0),
            new google.maps.Point(10, 34));
        var markers = [];        
        var markersDom = $('#markers > span');
        var overlays = [];
        
        
        var QT = {};
        
        QT.tileSize = 256;
        
       
        QT.mercator = {};
        QT.mercator.fromLatLngToPoint = function(LatLng){
            var NewPoint = new google.maps.Point();
            var xx = (LatLng.lng() + 180) / 360;
            NewPoint.x = xx * QT.tileSize;
            var sinLat = Math.sin(LatLng.lat() * Math.PI / 180);
            var yy = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
            NewPoint.y = yy * QT.tileSize;
            return NewPoint;
        };

        QT.mercator.fromPointToLatLng = function(point){
            var x = point.x / QT.tileSize - 0.5;
            var y = point.y / QT.tileSize - 0.5;
            var lat = 90 - 360 * Math.atan(Math.exp(y * 2 * Math.PI)) / Math.PI;
            var lng = 360 * x;
            var NewLatlng = new google.maps.LatLng(lat, lng);
            console.log(NewLatlng);
            return NewLatlng;
        };



        QT.encode = function(x, y, z){
            var arr = [];
            for(var i=z; i>0; i--) {
                var pow = 1<<(i-1);
                var cell = 0;
                
                if ((x&pow) != 0)
                    cell++;
                if ((y&pow) != 0)
                    cell+=2;
                    
                arr.push(cell);
            }
            return arr.join("");
        };


        QT.latLngToQuad = function(laLo){
            var zl = 30;
            var pnt = QT.mercator.fromLatLngToPoint(laLo);
  //var pnt = map.getProjection().fromLatLngToPoint(laLo); // test for comparision
            var tiX = Math.floor(pnt.x * Math.pow(2, zl) / QT.tileSize);
            var tiY = Math.floor(pnt.y * Math.pow(2, zl) / QT.tileSize);
            laLo.quad = QT.encode(tiX, tiY, zl);
            return laLo.quad;
        };



        google.maps.LatLng.prototype.getQuad = function(){
            if (this.quad) return this.quad;
            QT.latLngToQuad(this);
            return this.quad;
        };


        QT.decode = function(quad){
            var arr = quad.split("");
            var len = arr.length;
            var keyChain = [{x:0, y:0}, {x:1, y:0}, {x:0, y:1}, {x:1, y:1}];
            var xx = 0;
            var yy = 0;
            for (var i=len; i>0; i--){
                var mask = 1 << i;
                xx += keyChain[arr[i-1]].x / mask;
                yy += keyChain[arr[i-1]].y / mask;
            }
            xx *= 1<<len;
            yy *= 1<<len;
            return {x:xx, y:yy, z:len};
        };

        

        QT.quadToLatLng = function(quad){
            var tile = QT.decode(quad);
            var len = tile.z;
            var wP = {};
            wP.x = QT.tileSize * tile.x / Math.pow(2, len);
            wP.y = QT.tileSize * tile.y / Math.pow(2, len);
            return QT.mercator.fromPointToLatLng(wP);
        };





        QT.quadToBounds = function(quad, opt_options){
            var opts = opt_options || {};
            var level = quad.length;
            var part = quad.substring(0, level);
            var bounds = new google.maps.LatLngBounds(QT.quadToLatLng(part));
            console.log(QT.quadToLatLng(part));
            var SE = QT.nextDoor(quad, 1, 1).substring(0, level);
            bounds.extend(QT.quadToLatLng(SE));
            if (opts.visu){                // development aid
                opts.visu.bounds = bounds;   // option like {visu:{map:map}} visualizes bounds on map
                bounds.visu = new google.maps.Rectangle(opts.visu);
                console.log(opts.visu);
            }
            return bounds;
        };




        QT.nextDoor = function(quad, x_off, y_off){
            var xOff = parseInt(x_off, 10) || 0;
            var yOff = parseInt(y_off, 10) || 0;
            var me = QT.decode(quad);
            var xx = me.x + xOff;
            var yy = me.y + yOff;
            return QT.encode(xx, yy, me.z);
        };




        QT.clip = function(quad, level){
            var key = quad + "";
            return quad.substring(0, +level);
        };




        QT.validateQuad = function(quad, strict){
            if (+quad == 0) return quad;   // all zero treatment
            var preZeros = [];             // leading zero treatment
            for (var i=0, len=quad.length; i<len; i++){
                if (quad.charAt(i) != "0") break;
                preZeros.push("0");
            }
            var val = parseInt(quad, 4).toString(4);
            val = preZeros.join("") + val;
            if (strict && quad.length != val.length) return "";
            if (isNaN(+val)) return "";
            return val;
        };




        QT.base36ToQuad = function(str){
            return parseInt(str, 36).toString(4);
        };

        QT.quadToBase36 = function(str, opt_prec){
            var temp = str;
            if (opt_prec) temp = temp.substring(0, +opt_prec);
            return parseInt(temp, 4).toString(36);
        };






        QT.tree = {};                         // toDo: multiple tree objects
                                      //       include add2tree in .getQuad() ?

        QT.add2tree = function(ob){
            var key = ob.getQuad();
            QT.tree[key] = QT.tree[key] || [];  // identical keys handled by array structure
            QT.tree[key].push(ob);
        };


        QT.isPointInTree = function(obj, lev, callback){
            var quad = obj.getQuad();
            quad = quad.substring(0, +lev);
            var callMe = callback || function(){throw "No callback() in isPointInTree()"};
            var results = [];
            for (var key in QT.tree) {
                if (key.indexOf(quad) == 0) {
                    results.push(QT.tree[key]);
                }
            }
            callMe(results);
            return results;
        };
        
        
        
        
        
        
        function visualize(quad, from, to, opts){
            var min = from || 0;
            var max = to || 30;
            for (var i=min; i<max; i++){
                var key = QT.clip(quad, i);
                var bounds = QT.quadToBounds(key, {visu:opts});
                overlays.push(bounds.visu);
            }
        }  
        
        
        google.maps.event.addListener(map,"click", function(event){
            var str = prompt('Where is this place?','toilet');
            if(str)
            {
                //deleteMarkers();//doesn't work
                markersDom.append('<button class=".btn-default delete" >'+event.latLng+'</button>');
                var infowindow = new google.maps.InfoWindow(
                {
                   content: str
                });
                var marker_Click = new google.maps.Marker({
                    map: map,
                    position:event.latLng,
                    content: str
                }); 
                marker_Click.addListener('click', function() {
                               infowindow.open(map, marker_Click);
                });
                markers.push(marker_Click);

            }
            var lalo = event.latLng;
            var quad = lalo.getQuad();
            QT.add2tree(lalo);
            var polyProps = {
                map:map,
                clickable:false,
                fillOpacity: 0,
                strokeWeight:2,
                strokeColor:'#FF0000', strokeOpacity:1
            };
            visualize(quad, 1, 31,  polyProps);             
        });
        
        

});