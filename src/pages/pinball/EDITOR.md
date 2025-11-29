# Pinball Level Editor

A visual level editor for designing custom pinball boards using all available primitives.

## Features

### Available Primitives

1. **Bumpers** - Circular obstacles that award points and bounce the ball
2. **Triangular Bumpers** - Triangle-shaped obstacles for variety
3. **Rails** - Straight walls/guides for directing ball flow
4. **Curves** - Curved surfaces for smooth ball guidance
5. **Flippers** - Player-controlled flippers (left and right)

### Controls

#### Toolbar
- **Select (V)** - Click objects to select and edit properties
- **Bumper (B)** - Click to place circular bumpers
- **Triangle (T)** - Click to place triangular bumpers
- **Rail (R)** - Click start and end points to create rails
- **Curve (C)** - Click to place curved surfaces
- **Flipper (F)** - Click to place flippers (Alt+Click for right flipper)
- **Delete (D)** - Click objects to delete them

#### Keyboard Shortcuts
- `V` - Select tool
- `B` - Bumper tool
- `T` - Triangle tool
- `R` - Rail tool
- `C` - Curve tool
- `F` - Flipper tool
- `D` - Delete tool
- `Delete` - Remove selected object
- `Esc` - Deselect / Cancel current action

#### Mouse Controls
- **Click** - Place object / Select object
- **Shift+Click** - Place without grid snapping (precise placement)
- **Alt+Click** (Flipper tool) - Place right-side flipper

### Properties Panel

When an object is selected, a properties panel appears allowing you to:
- Adjust size, position, and other parameters
- Change point values for bumpers
- Modify angles for curves
- Switch flipper sides

### Export / Import

- **Export** - Copy board configuration to clipboard as JSON
- **Import** - Paste JSON to load a board configuration
- **Save & Play** - Save current board and test it in play mode
- **Clear** - Remove all objects from the board
- **Load Default** - Load the original default board layout

### Storage

Board configurations are automatically saved to localStorage, so your designs persist between sessions.

## Tips

1. **Grid Snapping** - By default, objects snap to a 20px grid. Hold Shift to disable snapping for precise placement.

2. **Rails** - Click once for start point, click again for end point. Press Esc to cancel.

3. **Flippers** - Always place a left and right flipper near the bottom for gameplay. The default position is at y=520.

4. **Launch Lane** - The right-side launch lane wall is automatically added and doesn't need to be placed.

5. **Curves** - After placing, use the properties panel to adjust the start/end angles for different curve shapes.

6. **Testing** - Frequently switch to Play mode to test your design and iterate.

## Design Best Practices

1. Place flippers at the bottom (y ~ 520)
2. Create interesting ball paths with curves and rails
3. Place bumpers in clusters for exciting gameplay
4. Use triangular bumpers strategically for deflection
5. Ensure the ball can always reach the flippers
6. Test frequently to ensure proper physics interactions
