var albumBucketName = "pa-b2";
var bucketRegion = "us-east-1";
var IdentityPoolId = "us-east-1:ba24ab52-3500-49e8-beb1-bfc81af16f7b";
var identityPoolCred = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: IdentityPoolId
});

AWS.config.update({
  region: bucketRegion,
  credentials: identityPoolCred
});

var s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  params: { Bucket: albumBucketName }
});

function listAlbums() {
  console.log(identityPoolCred);
  console.log(AWS.config);
  s3.listObjects({ Delimiter: "/" }, function(err, data) {
    if (err) {
      return alert("There was an error listing your albums: " + err.message);
    } else {
      var albums = data.CommonPrefixes.map(function(commonPrefix) {
        var prefix = commonPrefix.Prefix;
        var albumName = decodeURIComponent(prefix.replace("/", ""));
        return getHtml([
          "<li>",
          "<span onclick=\"deleteAlbum('" + albumName + "')\">X</span>",
          "<span onclick=\"viewAlbum('" + albumName + "')\">",
          albumName,
          "</span>",
          "</li>"
        ]);
      });
      var message = albums.length
        ? getHtml([
            "<p>Click on an album name to view it.</p>",
            "<p>Click on the X to delete the album.</p>"
          ])
        : "<p>You do not have any albums. Please Create album.";
      var htmlTemplate = [
        "<h2>Albums</h2>",
        message,
        "<ul>",
        getHtml(albums),
        "</ul>",
        "<button onclick=\"createAlbum(prompt('Enter Album Name:'))\">",
        "Create New Album",
        "</button>",
        `<div id="query-section" align="center">
            <div id="photo-query" align="center">
                <div class="container">
                    <form id="photo-query-form">
                        <div class="form-group">
                            <label for="query-input">Album Query</label>
                            <input type="text" class="form-control" id="query-input" aria-describedby="queryHelp" placeholder="Your Query">
                            <small id="queryHelp" class="form-text text-muted">What photos would you like to see in your album?</small>
                        </div>
                        <div class="submit-button" align="center"><button type="button" class="btn btn-primary" onclick="getQueries()">Query</button></div>
                    </form>
                </div>
            </div>
        </div>`,
        `<div class="container">
            <div id="error" class="isa_error"></div>
            <textarea id="transcript" placeholder="Press Start and speak into your mic" rows="5"
                readonly="readonly"></textarea>
            <div class="row">
                <div class="col">
                    <button id="start-button" class="button-xl" title="Start Transcription">
                        <i class="fa fa-microphone"></i> Record Speech Query
                    </button>
                    <button id="stop-button" class="button-xl" title="Stop Transcription" disabled="true"><i
                            class="fa fa-stop-circle"></i> Stop
                    </button>
                    <button id="reset-button" class="button-xl button-secondary" title="Clear Transcript"> 
                        Clear Transcript
                    </button>
                </div>
            </div>
        </div>`,
        "<div id=\"album-section\" align=\"center\">",
        "</div>"
      ];
      document.getElementById("app").innerHTML = getHtml(htmlTemplate);
    }
  });
}

function createAlbum(albumName) {
  albumName = albumName.trim();
  if (!albumName) {
    return alert("Album names must contain at least one non-space character.");
  }
  if (albumName.indexOf("/") !== -1) {
    return alert("Album names cannot contain slashes.");
  }
  var albumKey = encodeURIComponent(albumName) + "/";
  s3.headObject({ Key: albumKey }, function(err, data) {
    if (!err) {
      return alert("Album already exists.");
    }
    if (err.code !== "NotFound") {
      return alert("There was an error creating your album: " + err.message);
    }
    s3.putObject({ Key: albumKey }, function(err, data) {
      if (err) {
        return alert("There was an error creating your album: " + err.message);
      }
      alert("Successfully created album.");
      viewAlbum(albumName);
    });
  });
}

function viewAlbum(albumName) {
  var albumPhotosKey = encodeURIComponent(albumName) + "/";
  s3.listObjects({ Prefix: albumPhotosKey }, function(err, data) {
    if (err) {
      return alert("There was an error viewing your album: " + err.message);
    }
    // 'this' references the AWS.Response instance that represents the response
    var href = this.request.httpRequest.endpoint.href;
    var bucketUrl = href + albumBucketName + "/";

    var photos = data.Contents.map(function(photo) {
      var photoKey = photo.Key;
      var photoUrl = bucketUrl + encodeURIComponent(photoKey);
      return getHtml([
        "<span>",
        "<div>",
        '<img style="width:128px;height:128px;" src="' + photoUrl + '"/>',
        "</div>",
        "<div>",
        "<span onclick=\"deletePhoto('" +
          albumName +
          "','" +
          photoKey +
          "')\">",
        "X",
        "</span>",
        "<span>",
        photoKey.replace(albumPhotosKey, ""),
        "</span>",
        "</div>",
        "</span>"
      ]);
    });
    var message = photos.length
      ? "<p>Click on the X to delete the photo</p>"
      : "<p>You do not have any photos in this album. Please add photos.</p>";
    var htmlTemplate = [
      "<h2>",
      "Album: " + albumName,
      "</h2>",
      message,
      "<div>",
      getHtml(photos),
      "</div>",
      '<input id="photoupload" type="file" accept="image/*">',
      '<button id="addphoto" onclick="addPhoto(\'' + albumName + "')\">",
      "Add Photo",
      "</button>",
      '<button onclick="listAlbums(); setRecord()">',
      "Back To Albums",
      "</button>"
    ];
    document.getElementById("app").innerHTML = getHtml(htmlTemplate);
  });
}

function setRecord() {
  console.log("Getting Main");
  $.getScript("./main.js");
}

function addPhoto(albumName) {
  var files = document.getElementById("photoupload").files;
  if (!files.length) {
    return alert("Please choose a file to upload first.");
  }
  var file = files[0];
  console.log(file);
  var fileName = file.name;
  var albumPhotosKey = encodeURIComponent(albumName) + "/";

  var photoKey = albumPhotosKey + fileName;

  // Use S3 ManagedUpload class as it supports multipart uploads
  var upload = new AWS.S3.ManagedUpload({
    params: {
      Bucket: albumBucketName,
      Key: photoKey,
      Body: file,
      ACL: "public-read"
    }
  });

  var promise = upload.promise();

  promise.then(
    function(data) {
      alert("Successfully uploaded photo.");
      viewAlbum(albumName);
    },
    function(err) {
      return alert("There was an error uploading your photo: ", err.message);
    }
  );
}

function deletePhoto(albumName, photoKey) {
  s3.deleteObject({ Key: photoKey }, function(err, data) {
    if (err) {
      return alert("There was an error deleting your photo: ", err.message);
    }
    alert("Successfully deleted photo.");
    viewAlbum(albumName);
  });
  
  // Add S3 delete trigger
}

function deleteAlbum(albumName) {
  var albumKey = encodeURIComponent(albumName) + "/";
  s3.listObjects({ Prefix: albumKey }, function(err, data) {
    if (err) {
      return alert("There was an error deleting your album: ", err.message);
    }
    var objects = data.Contents.map(function(object) {
      return { Key: object.Key };
    });
    s3.deleteObjects(
      {
        Delete: { Objects: objects, Quiet: true }
      },
      function(err, data) {
        if (err) {
          return alert("There was an error deleting your album: ", err.message);
        }
        alert("Successfully deleted album.");
        listAlbums();
      }
    );
  });
}

function getQueries(){
  var query = $("#query-input").val();
  $("#query-input").val(null);
  console.log(query);
  var params = {"q": query};
  var body = {};
  var additionalParams = {
    headers: {},
    queryParams: {}
  };
  var apigClient = apigClientFactory.newClient();
	var responseBody = null;
	console.log("Getting request");
	apigClient.searchGet(params, body, additionalParams)
		.then(function(result){
			responseBody = result["data"]["body"];
			console.log(responseBody);
		}).catch(function(result){
			alert("Oops. Bad response. :(");
		});
	
	while (responseBody === null){
	  console.log("empty response");
	}
		
	setTimeout(function () {
  	var bucketURL = "https://pa-b2.s3.amazonaws.com/";
  	var gridBegin = "<div class=\"container\">";
  	var rowBegin = "<div class=\"row\">";
  	var rowEnd = "</div>";
  	var gridEnd = "</div>";
  	var colBegin = "<div class=\"col\">";
  	var colEnd = "</div>";
  	var gridMeat = "";
  	
  	if (responseBody != null) {
    	for (var i = 0; i < responseBody.length; i++){
    	  var photo = responseBody[i];
    	  if (i === 0){
    	    gridMeat += rowBegin;
    	  }
    	  else{ 
    	    if (i % 4 === 0){
    	      gridMeat += rowEnd;
    	      if (i != responseBody.length - 1){
    	        gridMeat += rowBegin;
    	      }
    	    }
    	    var image = "<img src=\"" + bucketURL + photo + "\"style=\"height: 200px; width: 200px;\">";
    	    gridMeat += colBegin + image + colEnd;
    	  }
    	}
  	}
  	
  	var grid = gridBegin + gridMeat + gridEnd;
  	$("#album-section").html(grid);
	}, 2000);
}