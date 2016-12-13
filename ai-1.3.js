var login = require("facebook-chat-api");
var fs = require('fs');
var math = require("mathjs");
var request = require("request");

"use strict";

var version = "1.3.0";

var db = {
	w: []
};

/*
	messageIn() is called when a message is recieved
	It submits the sentences to learnWords, then decides weather or not to respond and returns either the response or false
*/

function messageIn(msg){
	var msg_words = msg.replace(/\?/, ".");
	msg_words = msg.split(".");
	for(var i = 0; i < msg_words.length; i++)
		learnWords(removeNonWords(msg_words[i].split(" ")).reverse());
	if(shouldRespond(msg))
		return messageOut(msg);
	else
		return false;
}

/*
	messageOut generates a response based on the last message in
*/

function messageOut(o_msg){
	var msg = o_msg.split(" ").reverse();
	for(var i = 0; i < msg.length; i++)
		if(wordIndex(msg[i]) == -1){
			msg.splice(i, 1); i--;
		}
		var out = knowResponses(o_msg) || command(o_msg);
		out = out || genMessage(msg);
	console.log(out);
	return out;
}

/*
	When a response is generated, three things are tried.
	First it looks at known responses like "hi" and "lol",
	then checks if it's a command, and if both of those return false
	it generates a response.
*/

var known = [
	[["Hi", "hi", "hello", "Hello"],								["Hi", "Hello"]],
	[["Hey", "hey"],												["Hey", "Sup", "What's up?"]],
	[["lol", "Lol"],												["lol", "lol!", "haha", "hehe", "ha!"]],
	[["sup", "Sup"],												["Nothing, you?", "nm, wbu?", "Not much what about you?", "Not much. You?"]],
	[["Hows it going", "hows it going", "How are you", "how are you"], ["Great! You?", "good you?", "Good. How about you?"]],
];

/*
	Checks for known responses. This should be used vary rarely because
	ideally the generator would make messages like this.
*/

function knowResponses(msg){
	msg = msg.replace(/[\.\?!,']/g, "");
	msg = msg.replace(/bob| bob|bob | bob |/gi, "");
	for(var i = 0; i < known.length; i++){
		if(includes(known[i][0], msg))
			return known[i][1][r(known[i][1])];
	}
	return false;
}

/*
	Commands are useful and awesome. The general syntax is "bob {command} {arguments}".
	Some commands might be something like "How many words do you know?"
	Those are fine as long as they aren't detected often when the message in doesn't fit.

	In general, regex should be used instead of something like msg[2] == "". Regex can ignore capitol letters
	and it can be made to be more relaxed than strict comparison operators.
*/

function command(o_msg){

	// o_msg is the original message, msg is split by word, and bsg_b is the original minus the bob.
	var msg = o_msg.split(" ");
	var msg_b = o_msg.replace(/bob /i, "");

	if(!msg[0].match(/bob/i) || msg.length < 2)
		return false; // Returns false if the message doesn't start with bob.

	// It's a good idea to always return something for a command. That way it won't check for other commands after.
	// Returning specific errors or even false is good.

	//Preforms simple calculations

	if(msg[1].match(/calc|calculate|math|evaluate/i)){
		var equation = [];
		for(var i = 0; i < msg.length; i++)
			if(i > 1)
				equation.push(msg[i]);
		equation = equation.join(" ");
		var result = math.eval(equation);
		return result.toString();
	}

	// Tells you how many words he knows

	if(o_msg.match(/how many words|words do you|do you know|how smart|what words/ig))
		return "I know " + db.w.length + " words.";

	// Bob can tell you some of his abilities

	if(o_msg.replace(/bob /i, "").match(/what can|you do|your abilities|you able/i)){
		var message = [
			"I can convert currency. Try \"Bob convert USD to CAD\".",
			"I can calculate stuff. Try \"Bob calc 5 * sin(3) / 2\"",
			"I can tell you how many words I know. Try \"Bob how many words do you know?\"",
			"I can countdown to a holiday. Try \"Bob how many days until christmas?\""
		];
		return message[r(message)];
	}

	// Tells you his version

	if(msg_b.match(/what version|your version/i))
		return "I am version " + version;

	// Generates a random number

	if(msg_b.match(/random number/i)){
		if(msg_b.match(/pick a random number between/i)){
			var min = msg[6],
				max = msg[8];
			return (Math.floor(Math.random() * (max - min) + min)).toString();
		} else {
			return Math.random().toString();
		}
	}

	// Bob can tell you the time

	if(msg_b.match(/what time|the time|what day|what year|what month/i))
		return (new Date());

	// How many days until a holiday

	if(msg_b.match(/how many days|days until|how long|long til|long until|when is/i)){
		var holidays = {
			christmas: 359,
			christmas_eve: 358,
			halloween: 304,
			new_years: 1,
			new_years_eve: 365,
			valentines_day: 45
		};
		var query = msg[msg.length - 1].toLowerCase().replace(/\?/ig, "");
		var d = new Date();
		var start = new Date(d.getFullYear(), 0, 0);
		var day = Math.floor((d - start) / 1000 * 60 * 60 * 24);
		if(holidays[query]){
			if(holidays[query] < day)
				day -= 365;
			return "There are " + (holidays[query] - day + 1) + " days until " + query;
		}
	}

	if(o_msg.match(/how many times/i)){
		if(wordIndex(msg[msg.length - 1]) > -1)
			return db.w[wordIndex(msg[msg.length -1])].count + " times.";
		else
			return false;
	}

	// Currency conversion

	if(o_msg.replace(/bob /ig, "").match(/convert [\s\S]* to [\s\S]*/i) && msg.length > 4){
		var cur_a = msg[4],
			cur_b = msg[2];
		if(!currency.rates[cur_a])
			return "I do not know the currency " + cur_a;
		if(!currency.rates[cur_b])
			return "I do not know the currency " + cur_b;
		var tmp = 1 / currency.rates[cur_a];
		return "The rate is " + currency.rates[cur_b] * tmp + " " + cur_b + " to 1 " + cur_a;
	}

	/*
		List things. Bob can list things like currencies.
	*/

	if(o_msg.replace(/bob /ig, "").match(/list [\s\S]*/) && msg.length > 2)
		if(msg[2].match(/currencies|currency|money/i)){
			var result = "";
			for(var cur in currency.rates)
				result += cur + " ";
			return "Known currencies: " + result + "."; 
		}
	return false;
}

/*
	Decides weather or not to respond.
*/

function shouldRespond(msg){
	if(msg.match(/bob|everyone/ig))
		return true;
	return false;
}

/*
	Removes invalid words so it doesn't learn and start using non-words.
*/

var invalid_words = [
	"",
	" "
];

function removeNonWords(words){
	for(var i = 0; i < words.length; i++){
		if(includes(invalid_words, words[i])){
			words.splice(i, 1);
			i--;
		}
	}
	return words;
}

// Utility function to replace array.includes()

function includes(arr, item){
	for(var i = 0; i < arr.length; i++){
		if(arr[i] == item)
			return true;
	}
	return false;
}

// Returns a random index of an array

function r(arr){
	return Math.floor(Math.random()*arr.length);
}

/*
	Words are always stored as their index in db.w[]. This function finds the index.
*/

function wordIndex(word){
	for(var i = 0; i < db.w.length; i++)
		if(db.w[i].word === word)
			return i;
	return -1;
}

/*
	Not a very important function. ;)
	Each sentence is inspected individually and words are either
	added to the database with information or more information is
	gathered about that word.
*/

function learnWords(words){
	if(words.length < 1)
		return 0;

	for(var i = 0, w_length = words.length; i < w_length; i++){
		var index = wordIndex(words[i]);

		if(index < 0){ // If word is not known yet
			var new_word = {
				word: words[i],
				after: [],
				related: [],
				count: 0
			};
			var words_after = [];

			db.w.push(new_word);

			index = wordIndex(words[i]); // Set index now that the word exists
		}

		db.w[index].count++;

		var words_after = [];
		for(var x = 0; x < 3; x++){
			if(i > x)
				words_after.push(wordIndex(words[i-(x+1)]));
			else if(i == x)
				words_after.push(-1);
		}
		db.w[index].after.push(words_after);
	}
	
}

/*
	Generates a response based on an input message.
*/

function genMessage(topic){
	//The starting word is one of the important words from the original message
	var word = wordIndex(findMainWords(topic)[0]);
	
	var sentence = db.w[word].word;

	var length = Math.floor(Math.random()*(15)+25);
	
	var important_words = [];

	for(var i = 0; i < topic.length; i++)
		if(isSpecial(topic[i]))
			important_words.push(topic[i]);

	var words_done = [word];
	var possible = [[],[],[]];

	for(var i = 0; i < length; i++){
		if(db.w[word].after[0].length > 0){

				possible[0] = db.w[word].after;
				possible[1] = db.w[words_done.length - 1].after;
			if(i > 1)
				possible[2] = db.w[words_done.length - 2].after;

			word = pickNext(possible[0],possible[1],possible[2],[words_done.length - 1, words_done.length - 2 || false],important_words);	
			words_done.push(word);
			if(word > -1){
				sentence += " " + db.w[word].word;
			} else
				i = length;
		}
	}

	sentence += ".";
	return sentence;
}

// Chooses the next word in the sentence based on the last two words and the topic.

function pickNext(a, b, c, prev, topic){ //prev is [last word, word before that, etc.]
	var a_possible = []; //get all words that could possibly go next
	for(var i = 0; i < a.length; i++)
		a_possible.push(a[i][0]);
	var b_possible = []; //get all words that could go next considering the last 2 words
	for(var i = 0; i < b.length; b++)
		if(prev[0] == b[i][0])
			b_possible.push(b[i][1]);
	var c_possible = []; //get all possible words based on the last 3 words so far
	for(var i = 0; i < c.length; i++)
		if(prev[1] == c[i][1] && prev[0] == c[i][0]){
			c_possible.push(c[i][2]);
		}

	// If there's a word that makes sense in a large context, use it. Otherwise choose a word that
	// often occures after that last word.

	if(c_possible.length > 0)
		return c_possible[r(c_possible)];
	else if(b_possible.length > 0)
		return b_possible[r(b_possible)];
	else
		return a_possible[r(a_possible)];

	// If no good words are found at all, pick a random word.

	return db.w[r(db.w)].word;
}

/*
	Finds important words in a sentence like the topic and anything related to it.
*/

function findMainWords(words, count){
	var important = [];
	for(var i = 0; i < words.length; i++){
		if(isSpecial(words[i]))
			important.push(words[i]);
	}

	important = important.sort(function(a, b) {
		return a.length - b.length || a.localeCompare(b); // Sort by word length.
	});

	return important;
}

/*
	Learns words without generating a response.
*/

function justLearn(msg){
	var msg_words = msg.replace(/\?/, ".");
	msg_words = msg.split(".");
	for(var i = 0; i < msg_words.length; i++)
		learnWords(removeNonWords(msg_words[i].split(" ")).reverse());
}

// Finds the average count for a word. Useful for finding the rarity of a word in relation to every other word.

function avgCount(){
	var avg = 0;
	for(var i = 0; i < db.w.length; i++)
		avg += db.w[i].count;
	avg /= db.w.length;
	return avg;
}

/*
	Decides weather or not a word is important. This function needs work.
	Special words are things like 'president', 'cool', 'keyboard', and other words
	that might be the topic. This is important so the ai knows what the other person is
	talking about.
*/

function isSpecial(word){
	if(wordIndex(word) == -1)
		return false
	var avg = avgCount();
	var count = db.w[wordIndex(word)].count;
	if(count > avg + 1) return false;
	else return true;
}

/*
	Utility functions that can be used for various purposes.
*/

function mode(arr){
    var numMapping = {};
    var greatestFreq = 0;
    var mode;
    arr.forEach(function findMode(number) {
        numMapping[number] = (numMapping[number] || 0) + 1;

        if (greatestFreq < numMapping[number]) {
            greatestFreq = numMapping[number];
            mode = number;
        }
    });
    return +mode;
}

function median(values) {
    values.sort( function(a,b) {return a - b;} );
    var half = Math.floor(values.length/2);
    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
}

/*
	Bob can convert currency.
	This function updates from the web.
*/

var currency = {};

function updateCurrency(){
	request('http://api.fixer.io/latest', function (error, response, body) {
		if (!error && response.statusCode == 200) {
			currency = JSON.parse(body);
		}
	});
	console.log("Currency updated!");
}

updateCurrency();

/*
	Initialize the ai with some basic knowledge.
	The ai should know some words before it gets released out into the wild.
*/

// Wikipedia articles, essays, and news. (705,000 characters)
var words_to_learn = fs.readFileSync("/home/nathan/Documents/smallwords.txt").toString();

justLearn(words_to_learn);

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    //console.log('content-type:', res.headers['content-type']);
    //console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

login({email: "insert email here", password: "password"}, function callback (err, api) {
    if(err) return console.error(err);

    api.setOptions({listenEvents: true});
    var stopListening = api.listen(function(err, event) {
        if(err) return console.error(err);

        switch(event.type) {
          case "message":
            if(event.body === '/stop') {
              api.sendMessage("Goodbye...", event.threadID);
              return stopListening();
            }
            api.markAsRead(event.threadID, function(err) {
              if(err) console.log(err);
            });
            var msg = {
      			body: messageIn(event.body),
      			//attachment: fs.createReadStream(__dirname + '/out.png')
   			}
            api.sendMessage(msg, event.threadID);
            break;
          case "event":
            console.log(event);
            break;
        }
    });
});
