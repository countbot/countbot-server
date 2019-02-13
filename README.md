# CountBot

<a href="https://🍞🔪.ws"><img width=50px src="https://upload.wikimedia.org/wikipedia/en/2/29/Count_von_Count_kneeling.png" align="left" hspace="2" vspace="2"></a>

**Count Bot** is a GroupMe bot designed to keep track of the message count in a group and respond to user's count requests.

## Usage

Count Bot is quite versatile in the requests he can handle. He can return a total group message count or filter his count by any combination of username, dates, or specific message content. Count bot requests must begin with a '#' and may be followed by an optional series of parameters separated by '.'s. The basic format of a request is:

```
#.{userName}.{startDate}.{endDate}.{textQuery}
```

## Examples

Below are examples of all the requests he will respond to.

All messages:
```
#

Returns:
XXXX messages.
```

All messages from a single user:
```
#.User1

Returns:
User1 has posted XXXX messages.
```

All messages broken down by user **(Note that "ALL" is a special case username that will return a message count for every user that has posted messages fitting the other parameters in descending order.)**:
```
#.ALL

Returns:
User1 has posted XXXX messages.
User2 has posted XXXX messages.
User3 has posted XXXX messages.
...
UserN has posted XXXX messages.
```

All messages since a certain date (For now acceptable date formats are YYYYMMDD or YYYYMMDD'T'HHMMSS. This is being worked on to be more natural in a future release.):
```
#..20170810                          //Date equals 00:00AM on August 10th, 2017

Returns:
XXXX messages since 20170800.
```
```
#..20170810T083000                    //Date equals 8:30AM on August 10th, 2017

Returns:
XXXX messages since 20170800T083000.
```

All messages up to a certain date:
```
#...20170904                          //Date equals 00:00AM on September 4th, 2017

Returns:
XXXX messages before 20170800.
```
```
#...20170904T214523                    //Date equals 9:45:23PM on September 4th, 2017

Returns:
XXXX messages before 20170800T083000.
```

All messages between two dates:
```
#..20170810T083000.20170904

Returns:
XXXX messages between 20170810T083000 and 20170904.
```

All messages containing a specific text string:
```
#....🍞🔪

Returns:
XXXX messages containing "🍞🔪".
```

These parameters can be combined to perform more complex queries such as:

All messages from a single user since a certain date containing a specific text string:
```
#.User1.20170810..🍞🔪

Returns:
User1 has posted XXXX messages containing "🍞🔪" since 20170810.
```

Additionally you can supply username "ALL" on any query to get a list broken down by user:
```
#.ALL.20170810.20170910.🍞🔪

Returns:
User1 has posted XXXX messages containing "🍞🔪" between 20170810 and 20170910.
User2 has posted XXXX messages containing "🍞🔪" between 20170810 and 20170910.
User3 has posted XXXX messages containing "🍞🔪" between 20170810 and 20170910.
...
UserN has posted XXXX messages containing "🍞🔪" between 20170810 and 20170910.
```

If there are no messages matching the given parameters Count Bot will respond with:
```
Count Bot counts 0 messages matching those criteria.
```
