"use strict";

/*
	These functions are for figuring out if a guess to a trivia question is right or wrong. Guesses should be similar to the answer but they don't have to exactly equal it.
*/

var colors = require('colors');

var compareStrings = {

	dif: function(a, b) { // Find the difference as a percentage
		a = this.fix(a);
		b = this.fix(b);
		var length = a.length > b.length ? a.length : b.length;
		return ((length - this.distance(a, b)) / length * 100).toFixed(2);
	},

	fix: function(str) { // Fix the strings so that unimportant things like capitol letters wont be seen as different.
		return str
			.toLowerCase()
			.replace(/&/g, "and")
			.replace(/"|\(|\)/g, "")
			.replace(/^the/, "")
			.replace(/one/g, "1")
			.replace(/two/g, "2")
			.replace(/three/g, "3")
			.replace(/four/g, "4")
			.replace(/five/g, "5")
			.replace(/six/g, "6")
			.replace(/seven/g, "7")
			.replace(/eight/g, "8")
			.replace(/nine/g, "9")
			.replace(/zero/g, "0")
			.replace(/  */, " ");
	},

	distance: function(source, target) { // Use the Damerau Levenshtein method to find the difference between the two strings.
		if (!source) return target ? target.length : 0;
	    else if (!target) return source.length;

	    var m = source.length, n = target.length, INF = m+n, score = new Array(m+2), sd = {};
	    for (var i = 0; i < m+2; i++) score[i] = new Array(n+2);
	    score[0][0] = INF;
	    for (var i = 0; i <= m; i++) {
	        score[i+1][1] = i;
	        score[i+1][0] = INF;
	        sd[source[i]] = 0;
	    }
	    for (var j = 0; j <= n; j++) {
	        score[1][j+1] = j;
	        score[0][j+1] = INF;
	        sd[target[j]] = 0;
	    }

	    for (var i = 1; i <= m; i++) {
	        var DB = 0;
	        for (var j = 1; j <= n; j++) {
	            var i1 = sd[target[j-1]],
	                j1 = DB;
	            if (source[i-1] === target[j-1]) {
	                score[i+1][j+1] = score[i][j];
	                DB = j;
	            }
	            else {
	                score[i+1][j+1] = Math.min(score[i][j], Math.min(score[i+1][j], score[i][j+1])) + 1;
	            }
	            score[i+1][j+1] = Math.min(score[i+1][j+1], score[i1] ? score[i1][j1] + (i-i1-1) + 1 + (j-j1-1) : Infinity);
	        }
	        sd[source[i-1]] = i;
	    }
	    return score[m+1][n+1];
	}

};

var results = { // How close the strings have to be to be right or close.
	right: 75,
	close: 50,
	wrong: 0
}

function logDif(a, b) { // This function just helps test things.
	console.log(a + " ----- " + b);
	var dif = compareStrings.dif(a, b);
	if(dif > results.right)
		console.log((dif + "%").green)
	else if(dif > results.close)
		console.log((dif + "%").yellow)
	else
		console.log((dif + "%").red)
}


var right = [ // Test strings to compare. Ideally all of these should be detected as the rights answer.
	"the space needle", "space needle",
	"Julius Ceaser", "julius ceaser",
	"duck", "a duck",
	"the duck-billed platypus", "duck billed platypus",
	"Lincoln, Nebraska", "lincoln nebraska",
	"50 (USA)", "50",
	"The Moon", "moon",
	"\"5 second rule\"", "five second rule",
	"Alcatraz Island", "Alcatraz",
	"(Henry) Ford", "Henry Ford",
	"the Great wall of China", "the great wall"
];

var wrong = [
	"the space needle", "the space station",
	"a duck", "a duck-billed platypus",
	"(Henry) Ford", "Ford cars",
	"Bob Willis", "Tim Willis",
	"the Eiffel Tower", "Tower of Eiffel",
];

// Log the results of all the answers

console.log("Right answers:".green);
for(var i = 0; i < right.length - 1; i += 2)
	logDif(right[i], right[i + 1]);
console.log("Wrong answers:".red);
for(var i = 0; i < wrong.length - 1; i += 2)
	logDif(wrong[i], wrong[i + 1]);
