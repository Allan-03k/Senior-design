// client/src/App.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Navbar, Nav, Row, Col, Card, Button, Form, Badge, Modal, Spinner } from 'react-bootstrap';

// Backend API URL (Ensure Python backend is running on 5001)
const API_BASE = "http://localhost:5001/api";

// Common ingredients shortcuts (Simulating SuperCook's category selection)
const COMMON_INGREDIENTS = [
  "Egg", "Tomato", "Potato", "Onion", "Garlic", "Chicken", 
  "Beef", "Rice", "Pasta", "Milk", "Cheese", "Salt", "Oil"
];

// --- Modal Component: Display Recipe Details ---
function RecipeModal({ show, handleClose, recipe }) {
  if (!recipe) return null;
  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="border-0">
        <Modal.Title className="fw-bold">{recipe.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-4">
            <Badge bg="primary" className="me-2 p-2">{recipe.cuisine}</Badge>
            <Badge bg={recipe.match_ratio === 1 ? "success" : "warning"} className="p-2">
                Match: {Math.round(recipe.match_ratio * 100)}%
            </Badge>
        </div>
        <Row>
          <Col md={6}>
            <h5 className="border-bottom pb-2">🛒 Ingredients</h5>
            <ul className="list-group list-group-flush">
                {recipe.required_ingredients.map((ing, idx) => (
                    <li key={idx} className="list-group-item bg-transparent px-0">{ing}</li>
                ))}
            </ul>
          </Col>
          <Col md={6}>
            <h5 className="border-bottom pb-2">🔥 Instructions</h5>
            <p className="text-muted" style={{ whiteSpace: 'pre-line' }}>{recipe.steps || "No detailed steps provided."}</p>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer className="border-0">
        <Button variant="outline-secondary" onClick={handleClose}>Close</Button>
        <Button variant="dark">Start Cooking</Button>
      </Modal.Footer>
    </Modal>
  );
}

function App() {
  // Tab State: 'pantry' or 'restaurants'
  const [activeTab, setActiveTab] = useState('pantry'); 
  
  // --- Core State: Your Virtual Pantry ---
  const [pantry, setPantry] = useState([]); // Array to store ingredients, e.g., ["egg", "tomato"]
  const [inputValue, setInputValue] = useState(""); 
  
  // --- Result State ---
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // --- Restaurant State ---
  const [restaurants, setRestaurants] = useState([]);
  const [resLoading, setResLoading] = useState(false);

  // Automatically search for recipes when Pantry changes (Real-time effect)
  useEffect(() => {
    if (pantry.length > 0) {
        handleRecommend(pantry);
    } else {
        setRecipes([]); // Clear results if pantry is empty
    }
  }, [pantry]);

  // Add ingredient to pantry
  const addIngredient = (ing) => {
    const cleanIng = ing.trim().toLowerCase();
    // Prevent duplicates and empty strings
    if (cleanIng && !pantry.includes(cleanIng)) {
        setPantry([...pantry, cleanIng]);
    }
    setInputValue("");
  };

  // Remove ingredient from pantry
  const removeIngredient = (ingToRemove) => {
    setPantry(pantry.filter(i => i !== ingToRemove));
  };

  // Handle input keydown (Enter key)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addIngredient(inputValue);
    }
  };

  // Request backend for recommendation
  const handleRecommend = async (currentPantry) => {
    setLoading(true);
    try {
      // 1. Check local database first
      const res = await axios.post(`${API_BASE}/recipes/recommend`, { ingredients: currentPantry });
      let results = res.data.recipes;
      
      // 2. If local results are fewer than 2, search the web as a backup (Web Search API)
      if (results.length < 2) {
         try {
            const webRes = await axios.post(`${API_BASE}/recipes/search-web`, { ingredients: currentPantry });
            
            // Format conversion to adapt web results to our UI structure
            const webItems = webRes.data.items.map((item, idx) => ({
                id: `web-${idx}`,
                name: item.name,
                cuisine: "Web Discovery",
                match_ratio: item.score || 0.6, // Default passing score for web results
                required_ingredients: [], // Web results currently lack structured ingredients
                steps: item.instructions ? item.instructions[0] : "Click link to view source",
                image: item.url
            }));
            results = [...results, ...webItems];
         } catch(e) { console.log("Web search failed", e); }
      }
      setRecipes(results);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Restaurant search logic
  const searchRestaurants = async (cuisineType) => {
    setResLoading(true);
    try {
        // Default coordinates (e.g., near UConn), allows for future Geolocation integration
        const res = await axios.get(`${API_BASE}/restaurants/search`, {
            params: { cuisine: cuisineType, lat: 41.808, lng: -72.249 }
        });
        setRestaurants(res.data.results);
    } catch (err) { console.error(err); }
    setResLoading(false);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column">
      {/* Top Navigation */}
      <Navbar bg="white" className="shadow-sm border-bottom px-4" style={{height: '60px'}}>
        <Navbar.Brand className="fw-bold text-danger">
            SmartEats <span className="text-muted fw-light fs-6">| Senior Design Demo</span>
        </Navbar.Brand>
        <Nav className="ms-auto">
             <Button 
                variant={activeTab === 'pantry' ? "danger" : "outline-secondary"} 
                className="me-2 rounded-pill px-4"
                onClick={() => setActiveTab('pantry')}
             >
                🍳 My Pantry
             </Button>
             <Button 
                variant={activeTab === 'restaurants' ? "danger" : "outline-secondary"} 
                className="rounded-pill px-4"
                onClick={() => setActiveTab('restaurants')}
             >
                🍔 Dine Out
             </Button>
        </Nav>
      </Navbar>

      {/* Main Content Area */}
      <Container fluid className="flex-grow-1">
        {activeTab === 'pantry' ? (
            <Row className="h-100">
                {/* === Left Sidebar: Pantry Management === */}
                <Col md={3} className="bg-white border-end h-100 p-4" style={{minHeight: '90vh'}}>
                    <h5 className="mb-3">My Pantry ({pantry.length})</h5>
                    
                    {/* Input Box */}
                    <Form.Group className="mb-3 position-relative">
                        <Form.Control 
                            placeholder="Type ingredient + Enter..." 
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="rounded-pill bg-light border-0 px-3 py-2"
                        />
                    </Form.Group>

                    {/* Selected Ingredient Chips */}
                    <div className="d-flex flex-wrap gap-2 mb-4">
                        {pantry.map(item => (
                            <Badge key={item} bg="danger" className="p-2 rounded-pill" style={{cursor: 'pointer'}} onClick={() => removeIngredient(item)}>
                                {item} <span className="ms-1 opacity-50">×</span>
                            </Badge>
                        ))}
                        {pantry.length === 0 && <span className="text-muted small">Your pantry is empty.</span>}
                    </div>

                    {/* Quick Add Area */}
                    <h6 className="text-muted text-uppercase small fw-bold mb-3">Quick Add</h6>
                    <div className="d-flex flex-wrap gap-2">
                        {COMMON_INGREDIENTS.map(item => (
                            <Button 
                                key={item} 
                                variant="outline-light" 
                                className="text-dark border-0 bg-light btn-sm rounded-pill"
                                onClick={() => addIngredient(item)}
                            >
                                + {item}
                            </Button>
                        ))}
                    </div>
                </Col>

                {/* === Right Column: Recipe Results === */}
                <Col md={9} className="p-4" style={{backgroundColor: '#f8f9fa'}}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5>What you can make:</h5>
                        {loading && <Spinner animation="border" variant="danger" size="sm" />}
                    </div>

                    <Row>
                        {recipes.map(recipe => (
                            <Col lg={4} md={6} className="mb-4" key={recipe.id}>
                                <Card className="border-0 shadow-sm h-100 recipe-card" style={{cursor: 'pointer', transition: '0.2s'}} onClick={() => setSelectedRecipe(recipe)}>
                                    <div style={{height: '180px', overflow: 'hidden', position: 'relative'}}>
                                        <Card.Img variant="top" src={`https://placehold.co/600x400/orange/white?text=${encodeURIComponent(recipe.name)}`} />
                                        <Badge bg="light" text="dark" className="position-absolute top-0 end-0 m-2 shadow-sm">
                                            Match: {Math.round(recipe.match_ratio * 100)}%
                                        </Badge>
                                    </div>
                                    <Card.Body>
                                        <Card.Title className="h6 fw-bold">{recipe.name}</Card.Title>
                                        <Card.Text className="small text-muted">{recipe.cuisine}</Card.Text>
                                        <div className="small text-secondary mt-2">
                                            Missing: <span className="text-danger fw-bold">{(recipe.required_ingredients || []).length > 5 ? "View details" : "None"}</span>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                        {recipes.length === 0 && !loading && (
                            <div className="text-center mt-5 text-muted">
                                <h3>🥣</h3>
                                <p>Add ingredients to your pantry to see recipes!</p>
                            </div>
                        )}
                    </Row>
                </Col>
            </Row>
        ) : (
            // === Restaurant Tab Content ===
            <Container className="py-5">
                <div className="text-center mb-5">
                    <h2>Find Nearby Restaurants</h2>
                    <div className="d-flex justify-content-center gap-2 mt-3">
                        {["Italian", "Chinese", "Japanese", "American", "Mexican"].map(c => (
                            <Button key={c} variant="outline-danger" onClick={() => searchRestaurants(c)}>{c}</Button>
                        ))}
                    </div>
                </div>
                {resLoading && <div className="text-center"><Spinner animation="border"/></div>}
                <Row>
                    {restaurants.map((res, idx) => (
                        <Col md={4} key={idx} className="mb-4">
                             <Card className="border-0 shadow h-100">
                                <Card.Body>
                                    <h5>{res.name}</h5>
                                    <Badge bg="warning" text="dark">⭐ {res.rating}</Badge>
                                    <p className="small text-muted mt-2">{res.address}</p>
                                </Card.Body>
                             </Card>
                        </Col>
                    ))}
                </Row>
            </Container>
        )}
      </Container>

      <RecipeModal show={!!selectedRecipe} handleClose={() => setSelectedRecipe(null)} recipe={selectedRecipe} />
    </div>
  );
}

export default App;