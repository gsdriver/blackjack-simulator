/*
 * MIT License

 * Copyright (c) 2016 Garrett Vargas

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

const strategy = require('blackjack-strategy');
const shuffle = require('knuth-shuffle').knuthShuffle;
const fs = require('fs');

var deck = [];
const initialBet = 100;
const verboseLog = false; // If set to true, log verbose output to the console.  Just make sure numTrials and handsPerTrial are set small if true

// Controls how many times we'll run the simulation (yes, 10 million times!)
const numTrials = 10000;
const handsPerTrial = 1000;

// The count
var hiLoCount;

function Log(text)
{
    if (verboseLog)
    {
        console.log(text + "\r\n");
    }
}

function HandTotal(cards) 
{
    var retval = { total: 0, soft: false };
    var hasAces = false;

    for (var i = 0; i < cards.length; i++) {
        retval.total += cards[i];

        // Note if there's an ace
        if (cards[i] == 1) {
            hasAces = true;
        }
    }

    // If there are aces, add 10 to the total (unless it would go over 21)
    // Note that in this case the hand is soft
    if ((retval.total <= 11) && hasAces) {
        retval.total += 10;
        retval.soft = true;
    }

    return retval;
}

function DealCard()
{
    var card = deck.pop();

    if ((card >= 2) && (card <= 6))
    {
        hiLoCount++;
    }
    else if ((card == 1) || (card == 10))
    {
        hiLoCount--;
    }

    return card;
}

function PrintHand(cards)
{
    var text = "";

    for (var j = 0; j < cards.length - 1; j++)
    {
        text += (cards[j] + ", ");
    }
    text += cards[cards.length - 1];

    return text;
}
function InitializeDeck(numberOfDecks)
{
    // Initialize and shuffle 
    deck = [];

    for (var card = 1; card <= 13; card++)
    {
        // Add a card once for each suit
        for (var j = 0; j < 4*numberOfDecks; j++)
        {
            deck.push((card > 10) ? 10 : card);
        }
    }

    shuffle(deck);
    hiLoCount = 0;
}

// Plays the dealer's hand -- pretty straight forward, hit until bust or 17
function PlayDealerHand(dealerCards, options)
{
    var dealerTotal = HandTotal(dealerCards);

    while ((dealerTotal.total < 17) || ((dealerTotal.total == 17) && (dealerTotal.soft) && (options.hitSoft17)))
    {
        // Take a card
        dealerCards.push(DealCard());
        dealerTotal = HandTotal(dealerCards);
    }
}

// Plays a single player hand - the return is "done" if we complete this hand,
// or "split" if the decision is to split this hand (the caller performs the split)
// We don't currently handle insurance/noinsurance (sucker bet)
function PlayPlayerHand(hand, dealerCard, handCount, options)
{
    var suggestion = "";

    while (true)
    {
        suggestion = strategy.GetRecommendedPlayerAction(hand, dealerCard, handCount, true, options);
        switch (suggestion)
        {
            case "split":
                return "split";
                break;
            case "stand":
                return "stand";
                break;
            case "surrender":
                // Same as stand, but we are going to surrender so lose half the bet
                return "surrender";
                break;
            case "double":
                // Take a hit, and return double to indicate we are done
                hand.push(DealCard());
                return "double";
                break;
            case "hit":
                // Take a hit - if we busted, we are done and return BUST
                hand.push(DealCard());
                if (HandTotal(hand).total > 21)
                {
                    return "bust";
                }

                // Well, take another suggestion and loop again
                suggestion = strategy.GetRecommendedPlayerAction(hand, dealerCard, handCount, true, options);
                break;
        }
    }
}

function PlayThePlayer(playerHand, dealerCard, options)
{
    var handCount;
    var status;

    // OK, let's go - we need to loop in case we have to split
    for (handCount = 0; handCount < playerHand.length; handCount++)
    {
        // Exception - if the "splitAce" field is set on this hand, then we don't get to take an 
        // action UNLESS resplit aces is set - we need to make sure that will work
        if (playerHand[handCount].splitAce)
        {
            if ((!options.resplitAces) || (playerHand[handCount].cards[0] != playerHand[handCount].cards[1]))
            {
                Log("One card drawn to a split ace");
                continue;
            }

            // OK, you can resplit aces - make sure that we won't exceed the maximum number of hands
            if (playerHand.length == options.maxSplitHands)
            {
                Log("You reached the maximum number of hands with those aces");
                continue;
            }
        }

        status = PlayPlayerHand(playerHand[handCount].cards, dealerCard, playerHand.length, options);
        if (status == "split")
        {
            Log("Player cards: " + PrintHand(playerHand[handCount].cards) + " - dealer card: " + dealerCard + " - " + status);

            // OK, split this hand, deal a card onto each and continue
            var hand = {bet: initialBet, cards: []};

            // If you split aces, mark it
            if (playerHand[handCount].cards[0] == 1)
            {
                playerHand[handCount].splitAce = true;
                hand.splitAce = true;
            }

            hand.cards.push(playerHand[handCount].cards.pop());
            hand.cards.push(DealCard());
            playerHand[handCount].cards.push(DealCard());
            playerHand.push(hand);

            // We need to redo this hand in case they want to continue to hit
            handCount--;
            continue;
        }
        else if (status == "double")
        {
            playerHand[handCount].bet = playerHand[handCount].bet * 2;
        }
        else if (status == "surrender")
        {
            playerHand[handCount].surrender = true;
        }

        // Log out the status, for debugging
        Log("Player cards: " + PrintHand(playerHand[handCount].cards) + " - dealer card: " + dealerCard + " - " + status);
    }
}

function EvaluateHand(playerHand, dealerCards, options)
{
    var hand;
    var win = 0;
    var playerBlackjack = (playerHand.length == 1) && (playerHand[0].cards.length == 2) && (HandTotal(playerHand[0].cards).total == 21);
    var dealerBlackjack = (dealerCards.length == 2) && (HandTotal(dealerCards).total == 21);

    Log("Dealer hand: " + PrintHand(dealerCards));

    for (hand = 0; hand < playerHand.length; hand++)
    {
        if (playerHand[hand].surrender)
        {
            // Lose half the bet
            win -= (playerHand[hand].bet / 2);
            Log("Surrendered");
        }
        else
        {
            var playerTotal = HandTotal(playerHand[hand].cards).total;
            var dealerTotal = HandTotal(dealerCards).total;

            if (playerBlackjack)
            {
                if (dealerBlackjack)
                {
                    Log("Everone has blackjack - push");
                }
                else 
                {
                    Log("You win with blackjack");
                    win += (playerHand[hand].bet * (1 + options.BJPayout));
                }
            }
            else if (dealerBlackjack)
            {
                Log("Dealer has blackjack - you lose");
                win -= playerHand[hand].bet;
            }
            else if (playerTotal > 21)
            {
                // You lose
                win -= playerHand[hand].bet;
                Log("You busted");
            }
            else if (dealerTotal > 21)
            {
                // You win
                win += playerHand[hand].bet;
                Log("Dealer busted, you win");
            }
            else if (playerTotal > dealerTotal)
            {
                // You win
                win += playerHand[hand].bet;
                Log("Total " + playerTotal + " beats dealer " + dealerTotal);
            }
            else if (playerTotal < dealerTotal)
            {
                // You lose
                win -= playerHand[hand].bet;
                Log("Total " + playerTotal + " loses to dealer " + dealerTotal);
            }
            else
            {
                // You push
                Log("push - total " + dealerTotal);
            }
        }
    }

    Log("Total outcome $" + win);
    return win;
}

function RunAGame(options)
{
    var betAmount = initialBet;
    var trueCount;

    // Check if we need to reshuffle
    if (deck.length < Math.max(26, 13 * options.numberOfDecks))
    {
        Log("Shuffle");
        InitializeDeck(options.numberOfDecks);
    }

    // If we're counting, set the count and bet
    if (options.count && (options.count.system == "HiLo"))
    {
        trueCount = hiLoCount / (deck.length / 52);
        options.count.trueCount = trueCount;

        // Simple bet variation - double at +2, quadruple at +4, half at -3
        if (trueCount >= 4)
        {
            betAmount *= 4;
        }
        else if (trueCount >= 2)
        {
            betAmount *= 2;
        }
        else if (trueCount <= -3)
        {
            betAmount /= 2;
        }
    }
        
    // Deal cards to dealer and player
    var dealerCards = [];
    dealerCards.push(DealCard());
    dealerCards.push(DealCard());

    var playerHand = [];
    var hand = {bet: betAmount, cards: []};
    hand.cards.push(DealCard());
    hand.cards.push(DealCard());
    playerHand.push(hand);

    // Initial check - in case early surrender is offered
    if (strategy.GetRecommendedPlayerAction(playerHand[0].cards, dealerCards[0], 1, false, options) == "surrender")
    {
        // OK, surrender
        playerHand[0].surrender = true;
    }

    // Check blackjacks - if it's there, just end the game now
    if (!playerHand[0].surrender && (HandTotal(dealerCards).total != 21) && (HandTotal(dealerCards).total != 21))
    {
        // Now let's start to play
        PlayThePlayer(playerHand, dealerCards[0], options);
        PlayDealerHand(dealerCards, options);
    }

    return EvaluateHand(playerHand, dealerCards, options);
}

function standardDeviation(values){
  var avg = average(values);
  
  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });
  
  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + value;
  }, 0);

  var avg = sum / data.length;
  return avg;
}

// Holds the aggregate result from each run of X hands
var simulationResults = [];

// output file - if not defined we don't output
var outputFile = process.argv.slice(2)[0];

for (var trial = 0; trial < numTrials; trial++)
{
    var runningTotal = 0;

    for (var i = 0; i < handsPerTrial; i++)
    {
        // Here's where you control and can evaluation different options
        runningTotal += RunAGame({numberOfDecks: 2, BJPayout: 0.5, hitSoft17: false, strategyComplexity:"advanced", count: {system: "HiLo", trueCount: 0}});
        Log("Running total " + runningTotal);
        Log("");
    }

    simulationResults.push((((100 * runningTotal) / handsPerTrial) / initialBet));
}

// Calculate stddev and average
console.log("Average:" + average(simulationResults) + "%");
console.log("StdDev:" + standardDeviation(simulationResults) + "%");

// Write out all the results to a file if specified
if (outputFile)
{
    fs.appendFileSync(outputFile, "Average:" + average(simulationResults) + "\n");
    fs.appendFileSync(outputFile, "StdDev:" + standardDeviation(simulationResults) + "\n");
    for (var i = 0; i < simulationResults.length; i++)
    {
        fs.appendFileSync(outputFile, simulationResults[i] + "%\n");
    }
}
