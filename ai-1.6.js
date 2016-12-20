var login = require("facebook-chat-api");
var fs = require('fs');
var math = require("mathjs");
var request = require("request");
var http = require('http');

"use strict";

var version = "1.6.0";

var user_email = "example@gmail.com", password = "password";

var db = {
	w: []
};

var last_sentence;

var api_g;

/*
	messageIn() is called when a message is recieved.
	It submits the sentences to learnWords, then decides weather or not to respond and returns either the response or false.

	This function doesn't make sense. Good luck.
*/

function messageIn(e){

	if(typeof e == "undefined" || !e.body)
		return false;
	if(typeof e.body != "string")
		return false;

	var msg = e.body;
	var sentences = msg.split(".");

	console.log("Message in: " + msg + " ##########");

	for(var i = 0; i < sentences.length; i++)
		learnWords(removeNonWords(sentences[i].split(" ")).reverse()); // Learn words from the message

	if(shouldRespond(msg))			// Return a message or false
		return messageOut(msg, e);
	else {
		return false;
	}
}

/*
	messageOut generates a response based on the last message in. It first looks for commands and if it's not a command
	it generates a response.
*/

function messageOut(o_msg, e){
	var msg = o_msg.split(" ").reverse(); // Why do I reverse this? Who knows?
	for(var i = 0; i < msg.length; i++)
		if(wordIndex(msg[i]) == -1){
			msg.splice(i, 1); i--;
		}

	var out = command(o_msg, e) || genMessage(msg);

	console.log("Message out: " + out);

	return swearFilter(out);
}

/*
	Commands are useful and awesome. The general syntax is "bob {command} {arguments}".
	Some commands might be something like "How many words do you know?"
	Those are fine as long as they aren't detected often when the message in doesn't fit.

	In general, regex should be used instead of something like msg[2] == "". Regex can ignore capitol letters
	and it can be made to be more relaxed than strict comparison operators.
*/

function command(o_msg, e){

	// o_msg is the original message, msg is split by word, and msg_b is the original minus the bob.
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
			"I can countdown to a holiday. Try \"Bob how many days until christmas?\"",
			"I can pick a random number. Try \"Bob pick a random number between 5 and 800\"",
			"I can tell time. Try \"What time is it?\""
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

	// Tells you his favorite words

	if(msg_b.match(/what are your fav|your favorite words/i)){
		var img = fs.createReadStream(__dirname + '/words.png');
		api_g.sendMessage({
			attachment: img
		}, e.threadID);
		return false;
	}

	// How many times he's heard a word

	if(o_msg.match(/how many times/i)){
		if(wordIndex(msg[msg.length - 1]) > -1)
			return db.w[wordIndex(msg[msg.length -1])].count + " times.";
		else
			return false;
	}

	// Logs information about a word to chat

	if(msg_b.match(/show[\s\S]*info for/i))
		return JSON.stringify(db.w[wordIndex(msg[msg.length - 1])]);

	// Sets a reminder

	if(msg_b.match(/remind me [\s\S]* in/i)){
		var reminder = msg_b.replace(/remind me to|remind me|in[0-9]*seconds|in[\s\S]*hours|in[\s\S]*minutes/ig, "");
		var time = parseInt(msg[msg.length - 2]);

		var mod = msg[msg.length - 1];
		var mod_val = 0;
		
		if(mod.match(/second/i))
			mod_val = 1000;
		else if(mod.match(/minute/i))
			mod_val = 60000;
		else if(mod.match(/hour/i))
			mod_val = 3600000;
		else
			return "How long is a " + mod + "?";

		setTimeout((function(){api_g.sendMessage(reminder, e.threadID)}), time * mod_val);

		return "Reminder set!";
	}

	// Currency conversion

	if(msg_b.match(/convert [\s\S]* to [\s\S]*/i) && msg.length > 4){
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
		Changes the color of a chat.
	*/

	if(msg_b.match(/change color/i)){
		var color = msg[msg.length - 1];
		if(!color.length == 7 || !color.match(/#....../i))
			color = "#5467ff";	
 		api.changeThreadColor(color, e.threadID, function callback(err) {
 				if(err) return console.error(err);
 		});
	}
	
	/*
		Writes db.w to file.
	*/

	if(msg_b.match(/write db\.w/)){
		fs.writeFile('db.txt', JSON.stringify(db.w, null, "\t"), function (err) {
			if (err)
				return console.log(err);
			console.log('db.w saved to file!');
		});
		return "ok";
	}
	
	/*
		Says that Bob is talking
	*/
	
	if(msg_b.match(/talk!/i)){
		var talking = msg[msg.length - 1];
		api.sendTypingIndicator(e.threadID, function callback(err) {
 				if(err) return console.error(err);
 		});
	})
	
	/*
		List things. Bob can list things like currencies.
	*/

	if(msg_b.match(/list [\s\S]*/) && msg.length > 2)
		if(msg[2].match(/currencies|currency|money/i)){
			var result = "";
			for(var cur in currency.rates)
				result += cur + " ";
			return "Known currencies: " + result + "."; 
		}

	if(o_msg.match(/who am i/i))
		return sender;

	return false;
} // End commands

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

		if(!db.w[index].related)
			db.w[index].related = [];

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

	// Looks at the last sentence/message and learns related words.

	if(last_sentence){
		var main_in_last = findMainWords(last_sentence);
		var main_in_this = findMainWords(words);
		for(var a = 0, am = main_in_last.length; a < am; a++)
			for(var b = 0, bm = main_in_this.length; b < bm; b++){
				var index = wordIndex(main_in_last[a]);
				if(index > -1)
					db.w[index].related.push(main_in_this[b]);
			}
	}
	last_sentence = words;
}

/*
	Generates a response based on an input message.
*/

function genMessage(topic){
	//The starting word is one of the important words from the original message
	var important_words = findMainWords(topic); console.log("Important words: " + important_words);
	var word = pickFirstWord(important_words);

	var sentence = db.w[word].word;

	var length = Math.floor(Math.random()*(15)+25);
	

	var words_done = [word];
	var possible = [[],[],[]];

	for(var i = 0; i < length; i++){
		if(db.w[word].after[0].length > 0){

				possible[0] = db.w[word].after;
			if(i > 1){
				possible[1] = db.w[words_done[words_done.length - 2]].after;
			if(i > 2)
				possible[2] = db.w[words_done[words_done.length - 3]].after;
			}

			word = pickNext(possible[0],possible[1],possible[2],[words_done[words_done.length - 1], words_done[words_done.length - 2] || false],important_words);	
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

// Chooses the next word in the sentence based on the last 3 words and the topic.

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
		if(prev[0] == c[i][1] && prev[1] == c[i][0])
			c_possible.push(c[i][2]);

	// If there's a word that makes sense in a large context, use it. Otherwise choose a word that
	// often occures after that last word.

	console.log("Words matching topic: " + compare(a_possible, topic));

	if(c_possible.length > 0){
		console.log("C");
		return c_possible[r(c_possible)];
	}
	else if(b_possible.length > 0){
		console.log("B");
		return b_possible[r(b_possible)];
	}
	else if(a_possible.length > 0){
		console.log("A");
		return a_possible[r(a_possible)];
	}
	else
		// If no good words are found at all, pick a random word.
		return db.w[r(db.w)].word;
}

/*
	Finds important words in a sentence like the topic and anything related to it.
*/

function findMainWords(words, count){
	var important = [];
	var avg_count = avgCount();
	for(var i = 0; i < words.length; i++){
		if(db.w[wordIndex(words[i])].count < avg_count * 100 && !words[i].match(/bob/))
			important.push(words[i]);
	}

	// Sort by word length.
	important = important.sort(function(a, b){
		return b.length - a.length;
	});
	if(important.length > 0)
		return important;
	else
		return words[r(words)];
}

/*
	Picks the first word of a response.
*/

function pickFirstWord(msg){
	var main_words = findMainWords(msg);
	
	var possible = db.w[wordIndex(main_words[0])].related;
	
	if(possible.length < 1)
		return wordIndex(main_words[r(main_words)]);

	return wordIndex(possible[r(possible)]);
}

/*
	Compare two arrays. Return the index of the first word in [a] that matches [b].
*/

function compare(a, b){
	for(var i = 0; i < a.length; i++)
		if(includes(b, a[i]))
			return i;
	return false;
}

/*
	Learns words without generating a response.
*/

function justLearn(msg){
	var msg_words = msg.replace(/\?/, ".");
	msg_words = msg.split(".");
	for(var i = 0; i < msg_words.length; i++)
		learnWords(removeNonWords(msg_words[i].split(" ")).reverse());
	console.log("Words learned!");
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
	Anti-swear filter
*/

function swearFilter(str){
	if(typeof str != String)
		str = str.toString();
	return str.replace(/fuck|shit|damn|porn|dick|ass|slut|cunt|bitch|masterba|vagina|penis/ig, "****");
}

/*
	Load word db from file.
*/

justLearn(fs.readFileSync("/home/nathan/Documents/ai/reddit words.txt").toString());
justLearn(fs.readFileSync("/home/nathan/Documents/words/words.txt").toString());
justLearn(fs.readFileSync("/home/nathan/Documents/ai/more reddit words.txt").toString());

//db.w = JSON.parse(fs.readFileSync("/home/nathan/Documents/f/db.txt").toString());

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    //console.log('content-type:', res.headers['content-type']);
    //console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

login({email: user_email, password: user_password}, function callback (err, api) {
    if(err) return console.error(err);

    api_g = api;

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
      			body: messageIn(event),
   			}
            api.sendMessage(msg, event.threadID);
            break;
          case "event":
            console.log(event);
            break;
        }
    });
});
