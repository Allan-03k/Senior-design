// client/src/App.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Container,
  Navbar,
  Nav,
  Row,
  Col,
  Card,
  Button,
  Form,
  Badge,
  Modal,
  Spinner,
} from "react-bootstrap";

// Backend API base URL
const API_BASE = "http://localhost:5001/api";

// Common ingredients for "Quick Add"
const COMMON_INGREDIENTS = [
  "Egg",
  "Chicken",
  "Beef",
  "Pork",
  "Fish",
  "Shrimp",
  "Tofu",
  "Bacon",
  "Rice",
  "Pasta",
  "Noodles",
  "Bread",
  "Tortilla",
  "Potato",
  "Sweet Potato",
  "Milk",
  "Yogurt",
  "Cheese",
  "Butter",
  "Cream",
  "Tomato",
  "Onion",
  "Garlic",
  "Carrot",
  "Broccoli",
  "Spinach",
  "Lettuce",
  "Cabbage",
  "Cucumber",
  "Bell Pepper",
  "Mushroom",
  "Corn",
  "Green Onion",
  "Salt",
  "Pepper",
  "Sugar",
  "Soy Sauce",
  "Vinegar",
  "Oil",
  "Olive Oil",
  "Sesame Oil",
  "Tomato Sauce",
  "Ketchup",
  "Mayonnaise",
  "Ginger",
  "Chili",
  "Lemon",
  "Lime",
];

// Simple dictionary used to guess ingredients from a text snippet
const KNOWN_INGREDIENTS = [
  "egg",
  "eggs",
  "onion",
  "onions",
  "garlic",
  "tomato",
  "tomatoes",
  "potato",
  "potatoes",
  "butter",
  "milk",
  "cheese",
  "flour",
  "sugar",
  "oil",
  "olive oil",
  "salt",
  "pepper",
  "rice",
  "chicken",
  "beef",
  "pork",
  "fish",
  "beef broth",
  "chicken broth",
  "cream",
];

// Extract simple ingredient words from free text (very naive)
function extractIngredientsFromText(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = [];

  KNOWN_INGREDIENTS.forEach((word) => {
    if (lower.includes(word.toLowerCase())) {
      const clean = word.replace(/\s+/g, " ").trim();
      if (!found.includes(clean)) {
        found.push(clean);
      }
    }
  });

  return found;
}

// ========== Recipe Detail Modal ==========
function RecipeModal({
  show,
  handleClose,
  recipe,
  onShoppingList,
  shoppingList,
}) {
  if (!recipe) return null;

  const handleStartCookingClick = () => {
    const url = recipe.sourceUrl || recipe.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("This recipe does not have an external link.");
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="border-0">
        <Modal.Title className="fw-bold">{recipe.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="mb-4">
          <Badge bg="primary" className="me-2 p-2">
            {recipe.cuisine || "Recipe"}
          </Badge>
          {typeof recipe.match_ratio === "number" && (
            <Badge
              bg={recipe.match_ratio === 1 ? "success" : "warning"}
              className="p-2"
            >
              Match: {Math.round(recipe.match_ratio * 100)}%
            </Badge>
          )}
        </div>

        <Row>
          <Col md={6}>
            <h5 className="border-bottom pb-2">🛒 Ingredients</h5>
            <ul className="list-group list-group-flush">
              {(recipe.required_ingredients || []).map((ing, idx) => (
                <li key={idx} className="list-group-item bg-transparent px-0">
                  {ing}
                </li>
              ))}
              {(!recipe.required_ingredients ||
                recipe.required_ingredients.length === 0) && (
                <li className="list-group-item bg-transparent px-0 text-muted">
                  No structured ingredients available.
                </li>
              )}
            </ul>
          </Col>

          <Col md={6}>
            <h5 className="border-bottom pb-2">🔥 Instructions</h5>
            <p className="text-muted" style={{ whiteSpace: "pre-line" }}>
              {recipe.steps || "No detailed steps provided."}
            </p>
          </Col>
        </Row>

        {shoppingList && shoppingList.length > 0 && (
          <Row className="mt-4">
            <Col>
              <h5 className="border-bottom pb-2">
                🧾 Missing ingredients (Smart Shopping List)
              </h5>
              <ul className="list-group list-group-flush">
                {shoppingList.map((item, idx) => (
                  <li
                    key={idx}
                    className="list-group-item bg-transparent px-0 text-danger fw-bold"
                  >
                    • {item.ingredient}
                    {item.qty ? ` — ${item.qty}` : ""}
                  </li>
                ))}
              </ul>
            </Col>
          </Row>
        )}
      </Modal.Body>

      <Modal.Footer className="border-0">
        <Button variant="outline-secondary" onClick={handleClose}>
          Close
        </Button>
        <Button
          variant="outline-primary"
          onClick={() => onShoppingList && onShoppingList(recipe)}
          disabled={!onShoppingList}
        >
          Generate Shopping List
        </Button>
        <Button
          variant="dark"
          onClick={handleStartCookingClick}
          disabled={!(recipe.sourceUrl || recipe.url)}
        >
          Start Cooking
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ========== Scan Fridge Modal ==========
function ScanFridgeModal({
  show,
  handleClose,
  scanFile,
  setScanFile,
  scanPreview,
  setScanPreview,
  scanError,
  scanLoading,
  handleAnalyze,
}) {
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanFile(file);
    setScanPreview(URL.createObjectURL(file));
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Upload Picture</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-muted mb-3">
          Upload a clear ingredient photo for AI recognition.
        </p>

        <Form.Group className="mb-3">
          <Form.Control type="file" accept="image/*" onChange={handleFileChange} />
        </Form.Group>

        {scanPreview && (
          <div className="text-center mb-3">
            <img
              src={scanPreview}
              alt="Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "260px",
                borderRadius: "12px",
                border: "1px solid #ddd",
              }}
            />
          </div>
        )}

        {scanFile && (
          <div className="small text-muted mb-2">
            Selected file: {scanFile.name}
          </div>
        )}

        {scanError && <div className="text-danger small">{scanError}</div>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleAnalyze} disabled={scanLoading}>
          {scanLoading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Analyzing...
            </>
          ) : (
            "Analyze"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ========== Main Page ==========
function App() {
  const [activeTab, setActiveTab] = useState("pantry");

  // Pantry
  const [pantry, setPantry] = useState([]);
  const [inputValue, setInputValue] = useState("");

  // Recipes
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Shopping list
  const [shoppingList, setShoppingList] = useState([]);

  // Restaurants
  const [restaurants, setRestaurants] = useState([]);
  const [resLoading, setResLoading] = useState(false);

  // Vision scan modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState("");

  // Whenever pantry changes, refresh recommendations
  useEffect(() => {
    if (pantry.length > 0) {
      handleRecommend(pantry);
    } else {
      setRecipes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantry]);

  // Add ingredient to pantry
  const addIngredient = (ing) => {
    const cleanIng = ing.trim().toLowerCase();
    if (cleanIng && !pantry.includes(cleanIng)) {
      setPantry([...pantry, cleanIng]);
    }
    setInputValue("");
  };

  // Remove ingredient
  const removeIngredient = (ingToRemove) => {
    setPantry(pantry.filter((i) => i !== ingToRemove));
  };

  // Handle Enter in input
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient(inputValue);
    }
  };

  // Open scan modal
  const handleOpenScanModal = () => {
    setShowScanModal(true);
    setScanError("");
  };

  // Close scan modal
  const handleCloseScanModal = () => {
    setShowScanModal(false);
    setScanLoading(false);
    setScanError("");
    setScanFile(null);
    setScanPreview("");
  };

  // Upload image to backend and add detected ingredients to pantry
  const handleAnalyzeFridgeImage = async () => {
    if (!scanFile) {
      setScanError("Please upload a picture first.");
      return;
    }

    try {
      setScanLoading(true);
      setScanError("");

      const formData = new FormData();
      formData.append("image", scanFile);

      const res = await axios.post(
        `${API_BASE}/ingredients/recognize`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const detected = res.data.ingredients || [];

      if (detected.length === 0) {
        setScanError(
          "No clear ingredients detected. Try a closer and clearer photo."
        );
        return;
      }

      setPantry((prev) => {
        const merged = [...prev];
        detected.forEach((item) => {
          const normalized = String(item).trim().toLowerCase();
          if (normalized && !merged.includes(normalized)) {
            merged.push(normalized);
          }
        });
        return merged;
      });

      handleCloseScanModal();
    } catch (err) {
      console.error("Vision scan error:", err);
      setScanError("Failed to analyze image.");
    } finally {
      setScanLoading(false);
    }
  };

  // Call /recipes/recommend + /recipes/search-web
  const handleRecommend = async (currentPantry) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/recipes/recommend`, {
        ingredients: currentPantry,
      });
      let results = res.data.recipes || [];

      if (results.length < 50) {
        try {
          const webRes = await axios.post(`${API_BASE}/recipes/search-web`, {
            ingredients: currentPantry,
          });

          const webItems = (webRes.data.items || []).map((item, idx) => {
            const firstInstruction =
              item.instructions && item.instructions.length > 0
                ? item.instructions[0]
                : "";

            const structuredIngredients =
              item.ingredients && item.ingredients.length > 0
                ? item.ingredients
                : extractIngredientsFromText(firstInstruction);

            return {
              id: `web-${idx}`,
              name: item.name,
              cuisine: "Web Discovery",
              match_ratio: item.score || 0.6,
              required_ingredients: structuredIngredients,
              steps: firstInstruction || "Open source link for full recipe.",
              sourceUrl: item.url,
              image: item.image || null,
            };
          });

          const combined = [...results, ...webItems];

          const uniqueMap = new Map();
          combined.forEach((item) => {
            const key = `${item.name}-${item.sourceUrl || item.url || item.id}`;
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, item);
            }
          });

          results = Array.from(uniqueMap.values());
        } catch (e) {
          console.log("Web search failed", e);
        }
      }

      results = results.slice(0, 50);
      setRecipes(results);
    } catch (err) {
      console.error("Recommend error:", err);
      setRecipes([]);
    }
    setLoading(false);
  };

  // Local shopping-list generation
  const handleShoppingList = (recipe) => {
    if (!recipe) return;

    const required = recipe.required_ingredients || [];
    if (required.length === 0) {
      alert("This recipe does not have structured ingredients.");
      setShoppingList([]);
      return;
    }

    const pantrySet = new Set(pantry.map((p) => p.toLowerCase()));
    const missing = required.filter(
      (ing) => !pantrySet.has(String(ing).toLowerCase())
    );

    const listItems = missing.map((name) => ({
      ingredient: name,
      qty: "1 pack/unit",
    }));

    setShoppingList(listItems);
  };

  // Call /restaurants/search
  const searchRestaurants = async (cuisineType) => {
    setResLoading(true);
    setRestaurants([]);
    try {
      const res = await axios.get(`${API_BASE}/restaurants/search`, {
        params: { cuisine: cuisineType, lat: 41.808, lng: -72.249 },
      });
      setRestaurants(res.data.results || []);
    } catch (err) {
      console.error("Restaurant search error:", err);
      setRestaurants([]);
    }
    setResLoading(false);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column">
      <Navbar
        bg="white"
        className="shadow-sm border-bottom px-4"
        style={{ height: "60px" }}
      >
        <Navbar.Brand className="fw-bold text-danger">
          SmartEats{" "}
          <span className="text-muted fw-light fs-6">
            | Senior Design Demo
          </span>
        </Navbar.Brand>
        <Nav className="ms-auto">
          <Button
            variant={activeTab === "pantry" ? "danger" : "outline-secondary"}
            className="me-2 rounded-pill px-4"
            onClick={() => setActiveTab("pantry")}
          >
            🍳 My Pantry
          </Button>
          <Button
            variant={
              activeTab === "restaurants" ? "danger" : "outline-secondary"
            }
            className="rounded-pill px-4"
            onClick={() => setActiveTab("restaurants")}
          >
            🍔 Dine Out
          </Button>
        </Nav>
      </Navbar>

      <Container fluid className="flex-grow-1">
        {activeTab === "pantry" ? (
          <Row className="h-100">
            {/* Left: Pantry */}
            <Col
              md={3}
              className="bg-white border-end h-100 p-4"
              style={{ minHeight: "90vh" }}
            >
              <h5 className="mb-3 d-flex justify-content-between align-items-center">
                <span>My Pantry ({pantry.length})</span>
                {pantry.length > 0 && (
                  <Button
                    variant="link"
                    className="text-danger text-decoration-none p-0 small fw-bold"
                    style={{ fontSize: "0.85rem" }}
                    onClick={() => setPantry([])}
                  >
                    Clear All
                  </Button>
                )}
              </h5>

              {/* Scan Fridge Button */}
              <Button
                variant="outline-danger"
                className="w-100 mb-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                style={{ borderStyle: "dashed", borderWidth: "2px" }}
                onClick={handleOpenScanModal}
              >
                📷 Scan Fridge
              </Button>

              <Form.Group className="mb-3 position-relative">
                <Form.Control
                  placeholder="Type ingredient + Enter..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="rounded-pill bg-light border-0 px-3 py-2"
                />
              </Form.Group>

              <div className="d-flex flex-wrap gap-2 mb-4">
                {pantry.map((item) => (
                  <Badge
                    key={item}
                    bg="danger"
                    className="p-2 rounded-pill"
                    style={{ cursor: "pointer" }}
                    onClick={() => removeIngredient(item)}
                  >
                    {item}
                    <span className="ms-1 opacity-50">×</span>
                  </Badge>
                ))}
                {pantry.length === 0 && (
                  <div className="text-center w-100 text-muted small mt-2">
                    <p>Your pantry is empty.</p>
                    <p>👇 Use "Scan Fridge" or Quick Add below</p>
                  </div>
                )}
              </div>

              <h6 className="text-muted text-uppercase small fw-bold mb-3">
                Quick Add
              </h6>
              <div className="d-flex flex-wrap gap-2">
                {COMMON_INGREDIENTS.map((item) => (
                  <Button
                    key={item}
                    variant="outline-secondary"
                    size="sm"
                    className="rounded-pill"
                    onClick={() => addIngredient(item)}
                  >
                    + {item}
                  </Button>
                ))}
              </div>
            </Col>

            {/* Right: Recommended Recipes */}
            <Col md={9} className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  What you can make ({recipes.length} ideas):
                </h5>
                {loading && (
                  <div className="text-danger">
                    <Spinner animation="border" variant="danger" size="sm" />
                  </div>
                )}
              </div>

              <Row>
                {recipes.map((recipe) => {
                  const cardImage = recipe.image
                    ? recipe.image
                    : `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(
                        recipe.name
                      )}&font=roboto`;

                  return (
                    <Col
                      xl={2}
                      lg={3}
                      md={4}
                      sm={6}
                      xs={12}
                      className="mb-4"
                      key={recipe.id}
                    >
                      <Card
                        className="border-0 shadow-sm h-100 recipe-card"
                        style={{
                          cursor: "pointer",
                          transition: "0.2s",
                        }}
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setShoppingList([]);
                        }}
                      >
                        <div
                          style={{
                            height: "180px",
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <Card.Img
                            variant="top"
                            src={cardImage}
                            style={{
                              cursor: "pointer",
                              objectFit: "cover",
                              height: "180px",
                              width: "100%",
                            }}
                          />

                          {typeof recipe.match_ratio === "number" && (
                            <Badge
                              bg={
                                recipe.match_ratio === 1 ? "success" : "warning"
                              }
                              className="position-absolute top-0 end-0 m-2 shadow-sm"
                            >
                              Match: {Math.round(recipe.match_ratio * 100)}%
                            </Badge>
                          )}
                        </div>

                        <Card.Body>
                          <Card.Title className="h6 fw-bold text-truncate">
                            {recipe.name}
                          </Card.Title>
                          <Card.Text className="small text-muted">
                            {recipe.cuisine || "Recipe"}
                          </Card.Text>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })}

                {recipes.length === 0 && !loading && (
                  <div className="text-center mt-5 text-muted w-100">
                    <h3 style={{ fontSize: "3rem" }}>🥣</h3>
                    <p className="lead">
                      Add ingredients to your pantry to see recipes!
                    </p>
                  </div>
                )}
              </Row>
            </Col>
          </Row>
        ) : (
          <Container className="py-5">
            <div className="text-center mb-5">
              <h2 className="fw-bold">Find Nearby Restaurants</h2>
              <p className="text-muted">
                Based on location: Mansfield, CT (Simulated)
              </p>
              <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap">
                {[
                  "Italian",
                  "Chinese",
                  "Japanese",
                  "American",
                  "Mexican",
                  "Thai",
                  "Indian",
                ].map((c) => (
                  <Button
                    key={c}
                    variant="outline-danger"
                    className="rounded-pill px-4"
                    onClick={() => searchRestaurants(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>

            {resLoading && (
              <div className="text-center py-5">
                <Spinner animation="border" variant="danger" />
              </div>
            )}

            <Row>
              {restaurants.map((res, idx) => (
                <Col md={4} key={idx} className="mb-4">
                  <Card className="border-0 shadow h-100 hover-shadow">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <h5 className="fw-bold">{res.name}</h5>
                        {res.rating && (
                          <Badge bg="warning" text="dark">
                            ⭐ {res.rating}
                          </Badge>
                        )}
                      </div>
                      <p className="small text-muted mt-2 mb-0">
                        📍 {res.address || res.vicinity}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
              {!resLoading && restaurants.length === 0 && (
                <div className="text-center text-muted w-100 py-5">
                  Click a cuisine above to find restaurants.
                </div>
              )}
            </Row>
          </Container>
        )}
      </Container>

      <RecipeModal
        show={!!selectedRecipe}
        handleClose={() => {
          setSelectedRecipe(null);
          setShoppingList([]);
        }}
        recipe={selectedRecipe}
        onShoppingList={handleShoppingList}
        shoppingList={shoppingList}
      />

      <ScanFridgeModal
        show={showScanModal}
        handleClose={handleCloseScanModal}
        scanFile={scanFile}
        setScanFile={setScanFile}
        scanPreview={scanPreview}
        setScanPreview={setScanPreview}
        scanError={scanError}
        scanLoading={scanLoading}
        handleAnalyze={handleAnalyzeFridgeImage}
      />
    </div>
  );
}

export default App;