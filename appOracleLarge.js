var express = require('express');
var app= express();
var request = require("request");
var cheerio = require("cheerio");
var oracledb = require('oracledb');
var sleep = require('sleep');
var separateReqPool = {maxSockets: 10};

//Initialise database test
/*oracledb.getConnection(
{
    user:'hemang',
    password: 'hemangsoft',
    connectString: '172.16.0.25:1521/pdborcl'
 }, function (err, connection) {
        if (err) {
            console.error(err);
            return;
        }
		console.log("connected");
        connection.execute(
         "SELECT *FROM orderinformation", [],
         function (err, result) {
             if (err) {
                 console.error(err.message);


                 doRelease(connection);
                 return;
             }
             console.log(result.metaData);
             console.log(result.rows);
             doRelease(connection);
         });
});
*/

app.get('/',function(req,res){
   res.send("hello express test");
});

app.get('/getAllLink/',function(req,res){
   var url = "http://www.yourwebsite.com/hemangtest/";
   request(url, function (error, response, htmlBody) {
	if (!error && response.statusCode == 200) {
	    var $ = cheerio.load(htmlBody);

		var allPageLinks = [];
		var allATag = $("table tr > td > a").html();
		$('table tr > td > a').each(function (i, element) {
		  var objPage = {};
		  var linkHref = $(this).attr("href").toLowerCase();
		  
		  if (linkHref.indexOf(".html") > 0) {
		      objPage.PageLink = url + $(this).attr("href");
		      allPageLinks.push(objPage);
		  }
		});
        
		GetEachPageInformation(allPageLinks);
		
		res.send("All Files in progress");
	}
	else 
	{
		res.send("We’ve encountered an error: " + error);
	}
 });
});

   
app.get('/viewOrders/', function (req, res) {
    res.send("Orders goes here");
}
);

function GetEachPageInformation(arrPages)
{
	var requestBody =0;
	var noOfFileRead=1;
	arrPages.forEach(function (objPage) {
		//console.log( (noOfFileRead++) + " File request:"+ objPage.PageLink);
			
		request({url: objPage.PageLink, pool: separateReqPool}, function (error, response, htmlBody) {
			requestBody ++;
			
			if (!error && response.statusCode == 200) {
				GetOrderInformation(htmlBody);
				//console.log( requestBody + "success link " + objPage.PageLink);
			}
			else {
				console.log(requestBody + "We have encountered an error: " + error + " LINK:" + objPage.PageLink);
			}
			
			if(requestBody % 300 ==0)
			 sleep.sleep(3);
		});
   });
}

var noOfFileSaved =1;
function GetOrderInformation(htmlBody)
{
    var $ = cheerio.load(htmlBody);
	
	var PONumberNo = $("h1").eq(0).text();
    var POText = "Purchase Order #";
    if (PONumberNo.indexOf(POText) > 0) {
        PONumberNo = PONumberNo.substring(PONumberNo.indexOf(POText) + POText.length).trim();
    }

    var orderNumber = '';
    var orderDate = '';
    var expectedDeliveryDate = '';
    var storeNo = '';
    var accountNo = '';
    var subTeam = '';
    var buyer = '';
	var shipToBillTo ='';
	
    var scrapResult = [];
    $("table table").eq(0).find("tr").each(function (i, element) {
        var tdFirst = $(this).find("td").eq(0);
        var tdText = $(tdFirst).text().trim().toLowerCase();
        switch (tdText) {
            case "order number:":
                orderNumber = $(tdFirst).next().text();
                break;
            case "order date:":
                orderDate = $(tdFirst).next().text();
                break;
            case "expected delivery date:":
                expectedDeliveryDate = $(tdFirst).next().text();
                break;
            case "store no:":
                storeNo = $(tdFirst).next().text();
                break;
            case "account no:":
                accountNo = $(tdFirst).next().text();
                break;
            case "subteam:":
                subTeam = $(tdFirst).next().text();
                break;
            case "buyer:":
                buyer = $(tdFirst).next().text();
                break;
        }
    });

	$("table[width='50%']").eq(0).find("table[width='55%']").eq(1).find("tr").eq(1).each(function (i, element) {
        var tdFirst = $(this).find("td").eq(0);
		shipToBillTo = $(tdFirst).text();
	});
	
    var qryProducts = '';
    $("table[width='90%'] tr").each(function (i, element) {
        if (i > 0) //Header row
        {
            var lineNo = $(this).find("td").eq(0).text().trim();
            var ItemNo = $(this).find("td").eq(1).text();
            var qty = $(this).find("td").eq(2).text();
            var upcNo = $(this).find("td").eq(6).text();

            if (!isNaN(lineNo) && lineNo != '')
            {
				if(qryProducts != '')
			    {
				  qryProducts += " Union all ";
				}
				
				qryProducts += " Select '"+ PONumberNo +"','"+  storeNo  +"','"+  subTeam +"','"+ shipToBillTo +"','"+ ItemNo  +
							   "',TO_DATE('"+  orderDate +"','YYYY-MM-dd'),,TO_DATE('"+  expectedDeliveryDate +"','YYYY-MM-dd') ,'"+ qty +"' from dual";
            }
        }
    });

	
    if(qryProducts !='')
	 {
		noOfFileSaved ++;
		/*if(noOfFileSaved % 100 ==0) 
		{
		 console.log("GN: DB Save function");
		 sleep.sleep(2);
		 console.log("GM: DB Save function");
		}*/
	
		//Insert record into database
		oracledb.getConnection(
		{
			user:'hemang',
			password: 'hemangsoft',
			connectString: '172.16.0.25:1521/pdborcl'
		 }, function (err, connection) {
				if (err) {
					console.error(err.message);
					return;
				}
				
				connection.execute("INSERT INTO orderinformation (PONo,StoreNo,SubTeam,ShipToBillTo,ItemNo,OrderDate,expectedDeliveryDate,Qty)" + qryProducts,[], {autoCommit: true},
				 function (err, result) {
					 if (err) {
						 console.error(err.message);

						 doRelease(connection);
						 return;
					 }
					 console.log(noOfFileSaved +": Rows inserted: " + result.rowsAffected);
					 doRelease(connection);
				 });
		});
	}
 }

function doRelease(connection) {
    connection.release(
      function (err) {
          if (err) {
              console.error(err.message);
          }
      });
}

var server= app.listen(3000,function(){
  console.log('listing on port 3000');
});

