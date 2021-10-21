interface IERC20 {
  function totalSupply() external view returns (uint256);

  function balanceOf(address guy) external view returns (uint256);

  function allowance(address src, address guy) external view returns (uint256);

  function approve(address guy, uint256 wad) external returns (bool);

  function transfer(address dst, uint256 wad) external returns (bool);

  function transferFrom(
    address src,
    address dst,
    uint256 wad
  ) external returns (bool);

  event Approval(address indexed src, address indexed guy, uint256 wad);
  event Transfer(address indexed src, address indexed dst, uint256 wad);
}
