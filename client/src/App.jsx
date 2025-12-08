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

// 后端 API 根地址：如果端口不是 5001，在这里改
const API_BASE = "http://localhost:5001/api";

// 一些常见食材，用来从说明文本里“猜”出 ingredients
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

// 从一段文字里自动抽取常见食材（非常简单的规则版）
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

// ========== 菜谱详情弹窗 ==========
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
                <li
                  key={idx}
                  className="list-group-item bg-transparent px-0"
                >
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
            <p
              className="text-muted"
              style={{ whiteSpace: "pre-line" }}
            >
              {recipe.steps || "No detailed steps provided."}
            </p>
          </Col>
        </Row>

        {/* 购物清单：缺少的食材 */}
        {shoppingList && shoppingList.length > 0 && (
          <Row className="mt-4">
            <Col>
              <h5 className="border-bottom pb-2">🧾 Missing ingredients</h5>
              <ul className="list-group list-group-flush">
                {shoppingList.map((item, idx) => (
                  <li
                    key={idx}
                    className="list-group-item bg-transparent px-0"
                  >
                    {item.ingredient}
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
          Shopping list
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

// ========== 主页面 ==========
const COMMON_INGREDIENTS = [
  "Egg",
  "Tomato",
  "Potato",
  "Onion",
  "Garlic",
  "Chicken",
  "Beef",
  "Rice",
  "Pasta",
  "Milk",
  "Cheese",
  "Salt",
  "Oil",
];

function App() {
  const [activeTab, setActiveTab] = useState("pantry");

  // Pantry
  const [pantry, setPantry] = useState([]);
  const [inputValue, setInputValue] = useState("");

  // 菜谱
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Shopping list（缺少的食材）
  const [shoppingList, setShoppingList] = useState([]);

  // 餐厅
  const [restaurants, setRestaurants] = useState([]);
  const [resLoading, setResLoading] = useState(false);

  // pantry 一变就刷新推荐
  useEffect(() => {
    if (pantry.length > 0) {
      handleRecommend(pantry);
    } else {
      setRecipes([]);
    }
  }, [pantry]);

  // 添加食材
  const addIngredient = (ing) => {
    const cleanIng = ing.trim().toLowerCase();
    if (cleanIng && !pantry.includes(cleanIng)) {
      setPantry([...pantry, cleanIng]);
    }
    setInputValue("");
  };

  // 删除食材
  const removeIngredient = (ingToRemove) => {
    setPantry(pantry.filter((i) => i !== ingToRemove));
  };

  // 输入框回车
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient(inputValue);
    }
  };

  // 调用 /recipes/recommend + /recipes/search-web
  const handleRecommend = async (currentPantry) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/recipes/recommend`, {
        ingredients: currentPantry,
      });
      let results = res.data.recipes || [];

      // 本地菜谱太少，用 web 补
      if (results.length < 2) {
        try {
          const webRes = await axios.post(
            `${API_BASE}/recipes/search-web`,
            { ingredients: currentPantry }
          );

          const webItems = (webRes.data.items || []).map((item, idx) => {
            const firstInstruction =
              item.instructions && item.instructions.length > 0
                ? item.instructions[0]
                : "";

            // 如果 web 返回 ingredients，则用；否则从文字里猜
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
              steps:
                firstInstruction ||
                "Open source link for full recipe.",
              sourceUrl: item.url,
              image: item.image || null,
            };
          });

          results = [...results, ...webItems];
        } catch (e) {
          console.log("Web search failed", e);
        }
      }

      setRecipes(results);
    } catch (err) {
      console.error("Recommend error:", err);
      setRecipes([]);
    }
    setLoading(false);
  };

  // 前端本地计算购物清单：required_ingredients - pantry
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
      qty: 1,
    }));

    setShoppingList(listItems);
  };

  // 调用 /restaurants/search
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
      {/* 顶部导航 */}
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

      {/* 主内容区 */}
      <Container fluid className="flex-grow-1">
        {activeTab === "pantry" ? (
          <Row className="h-100">
            {/* 左侧：Pantry */}
            <Col
              md={3}
              className="bg-white border-end h-100 p-4"
              style={{ minHeight: "90vh" }}
            >
              <h5 className="mb-3">My Pantry ({pantry.length})</h5>

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
                  <span className="text-muted small">
                    Your pantry is empty.
                  </span>
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

            {/* 右侧：推荐菜谱 */}
            <Col md={9} className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">What you can make:</h5>
                {loading && (
                  <div className="text-danger">
                    <Spinner animation="border" variant="danger" size="sm" />
                  </div>
                )}
              </div>

              <Row>
                {recipes.map((recipe) => {
                  // 真实图片：优先用后端给的 image，否则用 Unsplash 搜索菜名
                  const cardImage = recipe.image
                    ? recipe.image
                    : `https://source.unsplash.com/600x400/?${encodeURIComponent(
                        recipe.name
                      )}`;

                  return (
                    <Col lg={4} md={6} className="mb-4" key={recipe.id}>
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
                              bg="light"
                              text="dark"
                              className="position-absolute top-0 end-0 m-2 shadow-sm"
                            >
                              Match: {Math.round(recipe.match_ratio * 100)}%
                            </Badge>
                          )}
                        </div>

                        <Card.Body>
                          <Card.Title className="h6 fw-bold">
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
                  <div className="text-center mt-5 text-muted">
                    <h3>🥣</h3>
                    <p>Add ingredients to your pantry to see recipes!</p>
                  </div>
                )}
              </Row>
            </Col>
          </Row>
        ) : (
          // 餐厅 Tab
          <Container className="py-5">
            <div className="text-center mb-5">
              <h2>Find Nearby Restaurants</h2>
              <div className="d-flex justify-content-center gap-2 mt-3">
                {["Italian", "Chinese", "Japanese", "American", "Mexican"].map(
                  (c) => (
                    <Button
                      key={c}
                      variant="outline-danger"
                      onClick={() => searchRestaurants(c)}
                    >
                      {c}
                    </Button>
                  )
                )}
              </div>
            </div>

            {resLoading && (
              <div className="text-center">
                <Spinner animation="border" />
              </div>
            )}

            <Row>
              {restaurants.map((res, idx) => (
                <Col md={4} key={idx} className="mb-4">
                  <Card className="border-0 shadow h-100">
                    <Card.Body>
                      <h5>{res.name}</h5>
                      {res.rating && (
                        <Badge bg="warning" text="dark">
                          ⭐ {res.rating}
                        </Badge>
                      )}
                      <p className="small text-muted mt-2">
                        {res.address || res.vicinity}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </Container>
        )}
      </Container>

      {/* 菜谱详情弹窗 */}
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
    </div>
  );
}

export default App;