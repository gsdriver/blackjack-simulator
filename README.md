"# blackjack-simulator" 

This application simulates a player going head-to-head against the dealer in rounds of blackjack.  The player will
play according to Basic Strategy rules, as determined by the `blackjack-strategy` project.  You can either change 
the options that are used for the game play or override the suggested Basic Strategy play if you want to see the
impact of different Basic Strategy rules of play.

Within simulator.js, you can set `handsPerTrial` to set the number of hands which will be played each trial, and
`numTrials` to determine the number of trials to run.  The default values of 1,000 and 10,000 respectively result in
10 million Blackjack hands being played, which completes in 60 seconds on my laptop (half of which is writing the
results to a file).  The average player (dis)advantage and standard deviation of the (dis)advantage are also written
out