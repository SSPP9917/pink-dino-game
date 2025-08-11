/* Pink Dino Platformer with enhanced visuals: textured ground, platforms and coins,
 * and cute monster enemies. Includes double-jump and crouch mechanics.
 */

const GAME_WIDTH = window.innerWidth;
const GAME_HEIGHT = window.innerHeight;
let player, cursors, coins, enemies, score = 0, scoreText;
// Key for attack on keyboard
let attackKey;
// Tracks states for mobile on-screen controls
// Added an 'attack' flag for the new tail swipe ability
let mobileControls = {
  left: false,
  right: false,
  jump: false,
  crouch: false,
  attack: false
};

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1000 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: {
    preload,
    create,
    update
  }
};

// Initialize the Phaser game
new Phaser.Game(config);

/**
 * Preload images. Only the dinosaur sprite needs loading from disk.
 */
function preload() {
  this.load.image('dino', 'dino.png');
}

/**
 * Create the scene with improved textures and new monster enemies.
 */
function create() {
  const levelWidth = 3000;
  const levelHeight = GAME_HEIGHT;
  // Configure camera and world bounds
  this.cameras.main.setBounds(0, 0, levelWidth, levelHeight);
  this.physics.world.setBounds(0, 0, levelWidth, levelHeight);

  // Add a sky background that remains stationary relative to the camera
  const sky = this.add.rectangle(levelWidth / 2, levelHeight / 2, levelWidth, levelHeight, 0x87CEEB);
  sky.setScrollFactor(0);

  // Generate textures for ground, platforms, coins and monsters
  generateTextures.call(this);

  // Ground: physics body and visual tile layer
  const groundHeight = 80;
  // Physics rectangle for ground collisions
  const groundRect = this.add.rectangle(levelWidth / 2, levelHeight - groundHeight / 2, levelWidth, groundHeight);
  this.physics.add.existing(groundRect, true);
  // Visual tile layer using 'ground' texture
  const groundTiles = this.add.tileSprite(levelWidth / 2, levelHeight - groundHeight / 2, levelWidth, groundHeight, 'ground');
  groundTiles.setOrigin(0.5);

  // Platforms: create static physics group with textured sprites
  const platforms = this.physics.add.staticGroup();
  const platformData = [
    { x: 400, y: levelHeight - 220 },
    { x: 800, y: levelHeight - 320 },
    { x: 1200, y: levelHeight - 250 },
    { x: 1600, y: levelHeight - 300 },
    { x: 2000, y: levelHeight - 200 },
    { x: 2400, y: levelHeight - 280 }
  ];
  platformData.forEach(cfg => {
    // Use textured platform sprite
    const plat = this.add.tileSprite(cfg.x, cfg.y, 200, 30, 'platform');
    this.physics.add.existing(plat, true);
    platforms.add(plat);
  });

  // Player: dinosaur sprite with physics and custom properties
  player = this.physics.add.sprite(100, levelHeight - groundHeight - 150, 'dino');
  player.setScale(0.2);
  player.setCollideWorldBounds(true);
  player.setBounce(0.1);
  player.body.setSize(player.width, player.height, true);
  player.jumpCount = 0;
  player.isCrouching = false;
  // Store the baseline y-position for bounce animation
  player.baseY = player.y;

  // Coins: static group with star texture
  coins = this.physics.add.staticGroup();
  const coinPositions = [
    { x: 400, y: platformData[0].y - 50 },
    { x: 800, y: platformData[1].y - 50 },
    { x: 1200, y: platformData[2].y - 50 },
    { x: 1600, y: platformData[3].y - 50 },
    { x: 2000, y: platformData[4].y - 50 },
    { x: 2400, y: platformData[5].y - 50 },
    { x: 2800, y: levelHeight - groundHeight - 50 }
  ];
  coinPositions.forEach(pos => {
    const coin = coins.create(pos.x, pos.y, 'coin');
    coin.body.updateFromGameObject();
    // Set origin to center to allow smooth rotation
    coin.setOrigin(0.5, 0.5);
  });

  // Enemies: monsters with cute design that patrol ground and platforms
  enemies = this.physics.add.group();
  const enemyPositions = [
    { x: 550, y: levelHeight - groundHeight - 20 },
    { x: 1850, y: levelHeight - groundHeight - 20 }
  ];
  enemyPositions.forEach(pos => {
    const enemy = enemies.create(pos.x, pos.y, 'monster');
    enemy.setCollideWorldBounds(true);
    enemy.setBounce(1, 0);
    const speed = Phaser.Math.Between(100, 150);
    enemy.setVelocityX(speed * (Phaser.Math.Between(0, 1) ? 1 : -1));
    enemy.body.setSize(enemy.width, enemy.height - 10);
    // Store baseline y and a random phase offset for bobbing animation
    enemy.baseY = enemy.y;
    enemy.offset = Math.random() * Math.PI * 2;
  });

  // Physics: collisions and overlaps
  this.physics.add.collider(player, groundRect);
  this.physics.add.collider(player, platforms);
  this.physics.add.collider(enemies, groundRect);
  this.physics.add.collider(enemies, platforms);
  this.physics.add.collider(enemies, enemies);
  this.physics.add.collider(player, enemies, hitEnemy, null, this);
  this.physics.add.overlap(player, coins, collectCoin, null, this);

  // Camera follows player smoothly
  this.cameras.main.startFollow(player);
  this.cameras.main.setLerp(0.15, 0);

  // Score text overlay
  scoreText = this.add.text(16, 16, 'Score: 0', {
    fontSize: '24px',
    fill: '#ffffff',
    fontFamily: 'Arial'
  }).setScrollFactor(0);

  // Keyboard input and mobile controls
  cursors = this.input.keyboard.createCursorKeys();
  // Add attack key (A) for keyboard players
  attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
  // Initialize attack cooldown timer on player
  player.attackCooldown = 0;
  buildMobileControls.call(this);
}

/**
 * Generate procedural textures for game objects.
 * This includes a ground tile, platform surface, coin star and monster.
 */
function generateTextures() {
  // Ground pattern: top green grass, bottom brown dirt with speckles
  {
    const size = 64;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Draw dirt base
    gfx.fillStyle(0x8B4513, 1);
    gfx.fillRect(0, 16, size, size - 16);
    // Add random darker speckles on dirt
    gfx.fillStyle(0x5A2A0A, 1);
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * size;
      const y = 16 + Math.random() * (size - 16);
      gfx.fillCircle(x, y, 1 + Math.random() * 2);
    }
    // Grass top
    gfx.fillStyle(0x4CAF50, 1);
    gfx.fillRect(0, 0, size, 16);
    // Grass blades
    gfx.fillStyle(0x3E8E41, 1);
    for (let i = 0; i < size; i += 4) {
      gfx.fillRect(i, 8 - Math.random() * 4, 2, 8);
    }
    gfx.generateTexture('ground', size, size);
    gfx.destroy();
  }
  // Platform pattern: wooden plank with darker stripes
  {
    const w = 200;
    const h = 30;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(0xA0522D, 1);
    gfx.fillRect(0, 0, w, h);
    // Draw wood grain lines
    gfx.lineStyle(1, 0x8B4513, 0.5);
    for (let i = 4; i < h; i += 6) {
      gfx.moveTo(0, i);
      gfx.lineTo(w, i + Phaser.Math.Between(-2, 2));
    }
    gfx.strokePath();
    gfx.generateTexture('platform', w, h);
    gfx.destroy();
  }
  // Coin: golden star with 5 points
  {
    const size = 40;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = 16;
    const innerRadius = 6;
    const points = 5;
    gfx.fillStyle(0xFFD700, 1);
    gfx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + r * Math.cos(angle - Math.PI / 2);
      const y = cy + r * Math.sin(angle - Math.PI / 2);
      if (i === 0) {
        gfx.moveTo(x, y);
      } else {
        gfx.lineTo(x, y);
      }
    }
    gfx.closePath();
    gfx.fillPath();
    // Outline
    gfx.lineStyle(2, 0xE6BE8A, 1);
    gfx.strokePath();
    gfx.generateTexture('coin', size, size);
    gfx.destroy();
  }
  // Monster: cute green creature with horns and a smile
  {
    const w = 50;
    const h = 50;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    // Body
    gfx.fillStyle(0x5DD27F, 1);
    gfx.fillRoundedRect(0, 10, w, h - 10, 8);
    // Head horns
    gfx.fillStyle(0xF4A460, 1);
    // left horn
    gfx.beginPath();
    gfx.moveTo(8, 10);
    gfx.lineTo(4, 0);
    gfx.lineTo(12, 0);
    gfx.closePath();
    gfx.fillPath();
    // right horn
    gfx.beginPath();
    gfx.moveTo(w - 8, 10);
    gfx.lineTo(w - 12, 0);
    gfx.lineTo(w - 4, 0);
    gfx.closePath();
    gfx.fillPath();
    // Eyes (white)
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(w * 0.35, 20, 5);
    gfx.fillCircle(w * 0.65, 20, 5);
    // Pupils
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(w * 0.35, 20, 2);
    gfx.fillCircle(w * 0.65, 20, 2);
    // Mouth
    gfx.fillStyle(0xE74C3C, 1);
    gfx.fillRoundedRect(w * 0.3, 30, w * 0.4, 8, 2);
    gfx.generateTexture('monster', w, h);
    gfx.destroy();
  }
}

/**
 * Build mobile control buttons: left, right, jump and crouch.
 */
function buildMobileControls() {
  const w = GAME_WIDTH;
  const h = GAME_HEIGHT;
  // Left button (triangle)
  const left = this.add.triangle(60, h - 70, 0, 20, 40, 20, 20, 0, 0xffffff).setOrigin(0.5);
  left.setAlpha(0.6);
  left.setScrollFactor(0);
  left.setInteractive(new Phaser.Geom.Polygon([0, 0, 40, 20, 0, 40]), Phaser.Geom.Polygon.Contains);
  left.on('pointerdown', () => { mobileControls.left = true; });
  left.on('pointerup', () => { mobileControls.left = false; });
  left.on('pointerout', () => { mobileControls.left = false; });
  // Right button (triangle)
  const right = this.add.triangle(140, h - 70, 0, 0, 40, 20, 0, 40, 0xffffff).setOrigin(0.5);
  right.setAlpha(0.6);
  right.setScrollFactor(0);
  right.setInteractive(new Phaser.Geom.Polygon([0, 0, 40, 20, 0, 40]), Phaser.Geom.Polygon.Contains);
  right.on('pointerdown', () => { mobileControls.right = true; });
  right.on('pointerup', () => { mobileControls.right = false; });
  right.on('pointerout', () => { mobileControls.right = false; });
  // Jump button (circle)
  const jump = this.add.circle(w - 80, h - 70, 35, 0xffffff, 0.6);
  jump.setScrollFactor(0);
  jump.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
  jump.on('pointerdown', () => { mobileControls.jump = true; });
  jump.on('pointerup', () => { mobileControls.jump = false; });
  jump.on('pointerout', () => { mobileControls.jump = false; });
  // Crouch button (circle next to jump)
  const crouch = this.add.circle(w - 160, h - 70, 35, 0xffffff, 0.6);
  crouch.setScrollFactor(0);
  crouch.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
  crouch.on('pointerdown', () => { mobileControls.crouch = true; });
  crouch.on('pointerup', () => { mobileControls.crouch = false; });
  crouch.on('pointerout', () => { mobileControls.crouch = false; });

  // Attack button (circle) for tail swipe ability
  // Positioned left of the crouch button. Tapping triggers an attack.
  const attack = this.add.circle(w - 240, h - 70, 35, 0xffffff, 0.6);
  attack.setScrollFactor(0);
  attack.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
  attack.on('pointerdown', () => { mobileControls.attack = true; });
  attack.on('pointerup', () => { mobileControls.attack = false; });
  attack.on('pointerout', () => { mobileControls.attack = false; });
}

/**
 * Handle coin collection: remove coin and update score.
 */
function collectCoin(playerObj, coin) {
  coin.disableBody(true, true);
  score += 10;
  scoreText.setText('Score: ' + score);
}

/**
 * Handle collision with enemies: briefly flash and restart the scene.
 */
function hitEnemy(playerObj, enemy) {
  if (!playerObj.active) return;
  playerObj.setTint(0xff0000);
  this.physics.pause();
  this.time.delayedCall(600, () => {
    score = 0;
    this.scene.restart();
  });
}

/**
 * Main update loop: manage movement, jumping, crouching and state resets.
 */
function update() {
  const moveSpeed = 200;
  const jumpVelocity = -550;
  // Current timestamp used for animations
  const time = this.time.now;
  // Horizontal movement
  if ((cursors.left && cursors.left.isDown) || mobileControls.left) {
    player.setVelocityX(-moveSpeed);
    player.flipX = true;
  } else if ((cursors.right && cursors.right.isDown) || mobileControls.right) {
    player.setVelocityX(moveSpeed);
    player.flipX = false;
  } else {
    player.setVelocityX(0);
  }
  // Determine if player is standing on ground or platform
  const onGround = player.body.blocked.down || player.body.touching.down;
  if (onGround) {
    player.jumpCount = 0;
  }
  // Jumping logic: allow two jumps before landing
  if (((cursors.up && cursors.up.isDown) || mobileControls.jump) && player.jumpCount < 2) {
    player.setVelocityY(jumpVelocity);
    player.jumpCount++;
    mobileControls.jump = false;
  }
  // Crouching logic: shrink the dinosaur vertically when crouch is held
  const wantsCrouch = (cursors.down && cursors.down.isDown) || mobileControls.crouch;
  if (wantsCrouch) {
    if (!player.isCrouching) {
      player.isCrouching = true;
      player.setScale(0.2, 0.12);
      player.body.setSize(player.width * 0.8, player.height * 0.6, true);
    }
  } else if (player.isCrouching) {
    player.isCrouching = false;
    player.setScale(0.2, 0.2);
    player.body.setSize(player.width, player.height, true);
  }

  // Animations for walking, jumping and bobbing
  if (onGround) {
    // Update baseline Y when stationary or crouching
    if (Math.abs(player.body.velocity.x) < 1 || player.isCrouching) {
      player.baseY = player.y;
    }
    if (Math.abs(player.body.velocity.x) > 1 && !player.isCrouching) {
      // Apply a small vertical bounce while moving on the ground
      player.y = player.baseY + Math.sin(time * 0.02) * 5;
    } else {
      player.y = player.baseY;
    }
    // Gradually return rotation to neutral if not attacking
    if (!player.isAttacking) {
      player.rotation *= 0.9;
      if (Math.abs(player.rotation) < 0.01) player.rotation = 0;
    }
  } else {
    // Airborne: tilt slightly based on direction to simulate momentum
    if (!player.isAttacking) {
      const targetRot = (player.flipX ? -0.25 : 0.25);
      player.rotation += (targetRot - player.rotation) * 0.1;
    }
  }

  // Apply bobbing animation to enemies
  enemies.children.iterate(enemy => {
    enemy.y = enemy.baseY + Math.sin(time * 0.005 + enemy.offset) * 3;
  });
  // Rotate coins continuously
  coins.children.iterate(coin => {
    coin.rotation += 0.05;
  });

  // Attack logic: if attack key or mobile button is pressed and cooldown allows
  const attackPressed = (attackKey && attackKey.isDown) || mobileControls.attack;
  if (attackPressed) {
    performAttack(this);
    // reset mobile attack flag to prevent auto-repeat
    mobileControls.attack = false;
  }
}

/**
 * Perform a tail swipe attack. Spawns an invisible hitbox briefly in front of the player
 * depending on facing direction. If it overlaps any monsters, they are destroyed and
 * the player is awarded extra points. A cooldown prevents spamming the attack.
 * @param {Phaser.Scene} scene The current game scene
 */
function performAttack(scene) {
  const now = scene.time.now;
  // Check if player is ready to attack (cooldown expired)
  if (player.attackCooldown && player.attackCooldown > now) {
    return;
  }
  // Set new cooldown (half a second)
  player.attackCooldown = now + 500;
  player.isAttacking = true;
  // Determine attack hitbox position relative to player facing
  const direction = player.flipX ? -1 : 1;
  const hitboxWidth = player.displayWidth * 0.8;
  const hitboxHeight = player.displayHeight * 0.6;
  const offsetX = direction * (player.displayWidth * 0.6);
  const offsetY = player.displayHeight * 0.2;
  // Create invisible hitbox (no sprite) using a physics body
  const hitbox = scene.physics.add.sprite(player.x + offsetX, player.y + offsetY, null);
  hitbox.setSize(hitboxWidth, hitboxHeight);
  hitbox.body.allowGravity = false;
  hitbox.visible = false;
  // Check overlap with enemies and remove them
  scene.physics.add.overlap(hitbox, enemies, (atk, enemy) => {
    enemy.disableBody(true, true);
    // Award bonus points for defeating monsters
    score += 20;
    scoreText.setText('Score: ' + score);
  });
  // Destroy hitbox and reset attacking state after a short duration
  scene.time.delayedCall(100, () => {
    hitbox.destroy();
    player.isAttacking = false;
  }, [], scene);

  // Rotate the player briefly to indicate tail swing (converted to radians)
  player.rotation = direction * 0.3;
}