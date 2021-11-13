// (c) nikolai mushegian
// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.9;

import "./erc20/IERC20.sol";

contract Feedbase {

  struct Feed {
    bytes32 val;
    uint256 ttl;
    uint256 prev;
  }

  struct Config {
    uint256 cost;
  }

  struct Request {
    uint256 paid;
    uint256 prev;
  }

  // _feeds  :: src -> tag -> time -> Feed
  mapping(address=>mapping(bytes32=>mapping(uint256=>Feed)))    public _feeds;
  // _bals   :: src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) public _bals;
  // _config :: src -> tag -> cash -> Config
  mapping(address=>mapping(
    bytes32=>mapping(address=>Config)))       public _config;
  // _reqs   :: src -> tag -> cash -> timestamp -> Request
  mapping(address=>mapping(
    bytes32=>mapping(
      address=>mapping(uint256=>Request))))   public _reqs;


  // For each (src, tag, cash) triple, maintain a list of requests
  // _reqHeads[src][tag][cash] is the timestamp of the head of this list (latest)
  // Each _reqs entry is associated with a timestamp
  // Each Request has a `prev` timestamp that points to the previous request
  // This is how we handle `push` to time ranges -- any request in the range can
  // pay for it
  // curRequest  = _reqs[src][tag][cash][curRequestTimestamp]
  // prevRequest = _reqs[src][tag][cash][curRequest.prev]
  // _reqHeads  :: src -> tag -> cash -> timestamp
  mapping(address=>mapping(
    bytes32=>mapping(address=>uint256)))       public _reqHeads;
  // _feedHeadTimes :: src -> tag -> timestamp
  mapping(address=>mapping(bytes32=>uint256))  public _feedHeadTimes;



  uint256 public constant BUFFER_TIME = 1000;

  event Push(
      address indexed src
    , bytes32 indexed tag
    , bytes32         val
    , uint256         ttl
  );

  event Paid(
      address indexed cash
    , address indexed src
    , address indexed dst
    , uint256         amt
    , uint256         ttl
  );

  event Drawn(
      address indexed cash
    , address indexed src
    , address indexed dst
    , uint256         amt
    , uint256         ttl
  );

  event Deposit(
      address indexed caller
    , address indexed cash
    , address indexed recipient
    , uint256         amount
  );

  event Withdrawal(
      address indexed caller
    , address indexed cash
    , address indexed recipient
    , uint256         amount
  );

  // TODO: review range convention ( currently [start, ttl) )
  function read(address src, bytes32 tag, uint256 time) public view returns (bytes32 val, uint256 ttl) {
    uint256 feedTime  = _feedHeadTimes[src][tag];
    Feed storage feed = _feeds[src][tag][feedTime];

    while( feedTime > time ) {
      feedTime = feed.prev;
      feed     = _feeds[src][tag][feedTime];
      require( feed.prev != feedTime, 'read: feed not found (1)' );
    }

    while( feedTime >= feed.ttl ) {
      feedTime = feed.prev;
      feed     = _feeds[src][tag][feedTime];
      require( feed.prev != feedTime, 'read: feed not found (2)' );
    }

    require( time < feed.ttl, 'read: feed not found (3)' );

    require( block.timestamp < feed.ttl, 'ERR_READ' );
    return (feed.val, feed.ttl);
  }

  function getRequestSlot(address src, bytes32 tag, address cash, uint256 time) private view returns (uint256 prev, uint256 next, bool found) {
    
    require( time != type(uint256).max, "getRequestSlot: time can't be max_uint" );
    uint256 spotTime     = _reqHeads[src][tag][cash];
    Request storage spot = _reqs[src][tag][cash][spotTime];

    if( spotTime == 0 ) {
      return (0, 0, false);
    } else if( spotTime < time ) {
      return (spotTime, 0, false);
    }

    uint256 nextTime = 0;
    while( spotTime > time ) {
      require( spotTime != 0, 'getRequestSlot: not found' );
      nextTime = spotTime;
      spotTime = spot.prev;
      spot     = _reqs[src][tag][cash][spotTime];
    }

    if( spotTime == time ) {
      return (spot.prev, nextTime, true);
    } else {
      return (spotTime, nextTime, false);
    }

  }

  function clean(address src, bytes32 tag, address cash, uint256 time) public {
    require( src == msg.sender || block.timestamp >= time + BUFFER_TIME, 'clean too early' );
    uint256 prevTime;
    uint256 nextTime;
    bool found;

    (prevTime, nextTime, found) = getRequestSlot(src, tag, cash, time);
    require(found, 'not found');
    Request storage req         = _reqs[src][tag][cash][time];

    if( nextTime == 0 ) {
      _reqHeads[src][tag][cash] = req.prev;
    } else {
      _reqs[src][tag][cash][nextTime].prev = req.prev;
    }

    _bals[msg.sender][cash] += req.paid;
    req.paid                 = 0;
    req.prev                 = 0;
  }

  function draw(bytes32 tag, address cash, uint256 start, uint256 ttl, uint256 cost) private {
    uint256 spotTime     = _reqHeads[msg.sender][tag][cash];
    Request storage spot = _reqs[msg.sender][tag][cash][spotTime];

    // TODO no more of this
    while( spotTime > 0 && (spotTime >= ttl) ) {
      spotTime = spot.prev;
      spot     = _reqs[msg.sender][tag][cash][spotTime];
      require( spotTime != spot.prev, 'not enough paid (1)' );
    }

    uint256 remaining = cost;
    uint256 nextTime  = type(uint256).max;
    while( remaining > 0  && spotTime >= start ) {
      if( nextTime == spotTime ) break;

      if( remaining >= spot.paid ) {
        Request storage next = _reqs[msg.sender][tag][cash][nextTime];

        remaining -= spot.paid;
        next.prev  = spot.prev;
        nextTime   = spotTime;
        spot.paid  = 0;
        // TODO do we need to clear _reqs?
        spotTime   = spot.prev;
        spot.prev  = 0;
      } else {
        spot.paid -= remaining;
        remaining = 0;
        nextTime  = spotTime;
        spotTime   = spot.prev;
        break;
      }

      spot = _reqs[msg.sender][tag][cash][spotTime];
    }

    require( remaining == 0, "not enough paid (2)" );
  }

  function push(bytes32 tag, bytes32 val, uint256 ttl, address cash, uint256 start) public returns (uint256) {
    require( ttl > start, 'push: invalid bounds' );

    Config storage config    = _config[msg.sender][tag][cash];
    Feed storage feed        = _feeds[msg.sender][tag][start];
    _bals[msg.sender][cash] += config.cost;

    draw(tag, cash, start, ttl, config.cost);
   
    feed.ttl   = ttl;
    feed.val   = val; 

    uint256 feedHeadTime            = _feedHeadTimes[msg.sender][tag];
    Feed storage feedHead           = _feeds[msg.sender][tag][feedHeadTime];
    // must push in chronological order (TODO: should we do this?)
    // can always update current head feed (>= instead of >) (TODO: should we do this?)
    require( start >= feedHeadTime, "push: collision with earlier push" );
    if( start > feedHeadTime ) {
      feed.prev                       = feedHeadTime;
    }
    _feedHeadTimes[msg.sender][tag] = start;

    emit Push(msg.sender, tag, val, ttl);

    return config.cost;
  }

  function requested(address src, bytes32 tag, address cash, uint256 time) public view returns (uint256) {
    return _reqs[src][tag][cash][time].paid;
  }

  function request(address src, bytes32 tag, address cash, uint256 amt, uint256 time) public {
    _bals[msg.sender][cash] -= amt;
    Request storage r = _reqs[src][tag][cash][time];
    r.paid           += amt;

    uint256 prevTime;
    uint256 nextTime;
    bool    found;
    (prevTime, nextTime, found) = getRequestSlot(src, tag, cash, time);

    if( !found ) {
      if( nextTime == 0 ) {
        _reqHeads[src][tag][cash] = time;
        r.prev                    = prevTime;
      } else {
        r.prev = prevTime;
        _reqs[src][tag][cash][nextTime].prev = time;
      }
    }
    emit Paid(cash, msg.sender, src, amt, time);
  }

  function deposit(address cash, address user, uint amt) public payable {
    bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
    require(ok, 'ERR_DEPOSIT_PULL');
    _bals[user][cash] += amt;
    emit Deposit(msg.sender, cash, user, amt);
  }

  function withdraw(address cash, address user, uint amt) public {
    _bals[msg.sender][cash] -= amt;
    bool ok = IERC20(cash).transfer(user, amt);
    require(ok, 'ERR_WITHDRAW_PUSH');
    emit Withdrawal(msg.sender, cash, user, amt);
  }

  function balances(address cash, address who) public view returns (uint) {
    return _bals[who][cash];
  }

  function setCost(bytes32 tag, address cash, uint256 cost) public {
    _config[msg.sender][tag][cash].cost = cost;
  }

}


