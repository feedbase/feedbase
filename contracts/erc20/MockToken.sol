pragma solidity ^0.8.6;

// DSToken with no auth
contract MockToken {
  modifier auth() {
    _;
  }

  // safemath included
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    return a + b;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    return a - b;
  }

  bool public stopped;
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  string public symbol;
  uint8 public decimals = 18; // standard token precision. override to customize
  string public name = ""; // Optional token name

  constructor(string memory symbol_) {
    symbol = symbol_;
  }

  event Approval(address indexed src, address indexed guy, uint256 wad);
  event Transfer(address indexed src, address indexed dst, uint256 wad);
  event Mint(address indexed guy, uint256 wad);
  event Burn(address indexed guy, uint256 wad);
  event Stop();
  event Start();

  modifier stoppable() {
    require(!stopped, "ERR_STOPPED");
    _;
  }

  function approve(address guy) external returns (bool) {
    return approve(guy, type(uint256).max);
  }

  function approve(address guy, uint256 wad) public stoppable returns (bool) {
    allowance[msg.sender][guy] = wad;

    emit Approval(msg.sender, guy, wad);

    return true;
  }

  function transfer(address dst, uint256 wad) external returns (bool) {
    return transferFrom(msg.sender, dst, wad);
  }

  function transferFrom(
    address src,
    address dst,
    uint256 wad
  ) public stoppable returns (bool) {
    if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
      require(allowance[src][msg.sender] >= wad, "ERR_LOW_ALLOWANCE");
      allowance[src][msg.sender] = sub(allowance[src][msg.sender], wad);
    }

    require(balanceOf[src] >= wad, "ERR_LOW_BALANCE");
    balanceOf[src] = sub(balanceOf[src], wad);
    balanceOf[dst] = add(balanceOf[dst], wad);

    emit Transfer(src, dst, wad);

    return true;
  }

  function push(address dst, uint256 wad) external {
    transferFrom(msg.sender, dst, wad);
  }

  function pull(address src, uint256 wad) external {
    transferFrom(src, msg.sender, wad);
  }

  function move(
    address src,
    address dst,
    uint256 wad
  ) external {
    transferFrom(src, dst, wad);
  }

  function mint(uint256 wad) external {
    mint(msg.sender, wad);
  }

  function burn(uint256 wad) external {
    burn(msg.sender, wad);
  }

  function mint(address guy, uint256 wad) public auth stoppable {
    balanceOf[guy] = add(balanceOf[guy], wad);
    totalSupply = add(totalSupply, wad);
    emit Mint(guy, wad);
  }

  function burn(address guy, uint256 wad) public auth stoppable {
    if (guy != msg.sender && allowance[guy][msg.sender] != type(uint256).max) {
      require(allowance[guy][msg.sender] >= wad, "ERR_LOW_ALLOWANCE");
      allowance[guy][msg.sender] = sub(allowance[guy][msg.sender], wad);
    }

    require(balanceOf[guy] >= wad, "ERR_LOW_BALANCE");
    balanceOf[guy] = sub(balanceOf[guy], wad);
    totalSupply = sub(totalSupply, wad);
    emit Burn(guy, wad);
  }

  function stop() public auth {
    stopped = true;
    emit Stop();
  }

  function start() public auth {
    stopped = false;
    emit Start();
  }

  function setName(string memory name_) public auth {
    name = name_;
  }
}
