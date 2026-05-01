// client/src/App.jsx
import { useState, useEffect, useRef } from "react";
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
import RestaurantMap from "./RestaurantMap.jsx";

// Backend API base URL
const API_BASE = "http://localhost:5001/api";

function extractFirstHttpUrl(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.match(/https:\/\/[^\s)\]'"<>]+/);
  if (!m) return null;
  return m[0].replace(/[.,;]+$/, "");
}

// Common ingredients for "Quick Add" - organized by category
const COMMON_INGREDIENTS = {
  "🥩 Proteins": [
    "Egg",
    "Chicken",
    "Beef",
    "Pork",
    "Fish",
    "Shrimp",
    "Tofu",
    "Bacon",
    "Lamb",
    "Turkey",
    "Duck",
    "Salmon"
  ],
  "🥗 Vegetables": [
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
    "Zucchini",
    "Asparagus",
    "Green Beans",
    "Peas",
    "Eggplant"
  ],
  "🍎 Fruits": [
    "Lemon",
    "Lime",
    "Orange",
    "Pineapple",
    "Apple",
    "Banana",
    "Strawberry",
    "Blueberry",
    "Avocado",
    "Mango",
    "Papaya"
  ],
  "🌾 Grains & Pasta": [
    "Rice",
    "Pasta",
    "Noodles",
    "Bread",
    "Tortilla",
    "Oats",
    "Couscous",
    "Quinoa"
  ],
  "🥔 Root Vegetables": [
    "Potato",
    "Sweet Potato",
    "Yam",
    "Beet"
  ],
  "🥛 Dairy & Eggs": [
    "Milk",
    "Yogurt",
    "Cheese",
    "Butter",
    "Cream",
    "Sour Cream"
  ],
  "🧂 Seasonings & Spices": [
    "Salt",
    "Pepper",
    "Sugar",
    "Ginger",
    "Chili",
    "Soy Sauce",
    "Vinegar",
    "Ketchup",
    "Mayonnaise",
    "Tomato Sauce",
    "Hot Sauce",
    "Paprika",
    "Cumin",
    "Oregano",
    "Thyme",
    "Basil",
    "Cinnamon",
    "Honey"
  ],
  "🫒 Oils & Fats": [
    "Oil",
    "Olive Oil",
    "Sesame Oil",
    "Coconut Oil",
    "Vegetable Oil",
    "Butter",
    "Lard"
  ]
};

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

function normalizeIngredientText(text) {
  if (!text) return "";
  let s = String(text).toLowerCase();
  s = s.replace(/^[\u2022\-*]+\s*/g, "");
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/[,:;|]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Remove leading quantity fragments like "1", "1/2", "1.5"
  s = s.replace(/^(\d+([./]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*/g, "");

  // Remove common leading units/descriptors often found in scraped lines.
  s = s.replace(
    /^(cups?|cup|tbsp|tsp|teaspoons?|tablespoons?|oz|ounces?|lb|pounds?|g|kg|ml|l|cloves?|slices?|cans?|packages?|pinch|large|small|medium)\s+/g,
    ""
  );

  // Remove prep words from ingredient tails, e.g. "onion, chopped".
  s = s.replace(
    /\b(chopped|minced|diced|sliced|fresh|optional|to taste|divided|for serving)\b/g,
    " "
  );
  s = s.replace(/\s+/g, " ").trim();

  // Lightweight singularization for matching pantry words.
  if (s.endsWith("es") && s.length > 4) s = s.slice(0, -2);
  else if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
  return s.trim();
}

function isMetaIngredientLine(raw) {
  if (!raw) return true;
  const s = String(raw).trim().toLowerCase();
  if (!s) return true;
  if (s === "or" || s === "optional") return true;
  if (s.endsWith(":") && /^(optional|for|for garnish|for garnishing)/.test(s)) {
    return true;
  }
  return /^(optional|or|for garnish|for garnishing)\b/.test(s);
}

function getIngredientCandidates(raw) {
  if (isMetaIngredientLine(raw)) return [];
  const cleanedRaw = String(raw).replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanedRaw) return [];

  const parts = cleanedRaw
    .split(/\s+\bor\b\s+|\s*\/\s*/i)
    .map((p) => normalizeIngredientText(p))
    .filter(Boolean)
    .filter((p) => !isMetaIngredientLine(p))
    .filter((p) => p.length >= 2);

  return [...new Set(parts)];
}

function pickDisplayIngredient(raw) {
  const candidates = getIngredientCandidates(raw);
  if (candidates.length === 0) return "";

  // Prefer two-word phrase for readability, fallback to first candidate.
  const phrase = candidates.find((c) => c.includes(" "));
  return phrase || candidates[0];
}

function hasPantryMatch(rawIngredient, pantrySet) {
  const candidates = getIngredientCandidates(rawIngredient);
  if (candidates.length === 0) return true;

  return candidates.some((norm) => {
    if (pantrySet.has(norm)) return true;

    const tokens = norm.split(" ").filter(Boolean);
    if (tokens.length === 0) return false;

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      if (pantrySet.has(phrase)) return true;
    }

    return tokens.some((t) => pantrySet.has(t));
  });
}

// ========== Recipe Detail Modal ==========
function RecipeModal({
  show,
  handleClose,
  recipe,
  onShoppingList,
  shoppingList,
}) {
  const [cookingGuide, setCookingGuide] = useState(null);
  const [cookingLoading, setCookingLoading] = useState(false);
  const [cookingError, setCookingError] = useState(null);

  if (!recipe) return null;

  const handleStartCookingClick = () => {
    const url = recipe.sourceUrl || recipe.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("This recipe does not have an external link.");
    }
  };

  const handleGenerateVideo = async () => {
    setCookingLoading(true);
    setCookingError(null);
    try {
      const res = await fetch("http://localhost:5001/api/generate-cooking-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_name: recipe.name || "Unknown Recipe",
          ingredients: recipe.required_ingredients || [],
          steps: recipe.steps ? [recipe.steps] : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCookingGuide(data);
      } else {
        setCookingError(data.error || "Generation failed, please try again");
      }
    } catch (err) {
      setCookingError("Request failed: " + err.message);
    } finally {
      setCookingLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={() => { setCookingGuide(null); setCookingError(null); handleClose(); }} size="lg" centered>
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
            {cookingGuide ? (
              <>
                <h5 className="border-bottom pb-2">🎬 Cooking Tutorial</h5>
                <video width="100%" controls style={{ borderRadius: "8px" }}>
                  <source src={`http://localhost:5001${cookingGuide.video_url}`} type="video/mp4" />
                </video>
              </>
            ) : cookingLoading ? (
              <>
                <h5 className="border-bottom pb-2">🎬 Cooking Tutorial</h5>
                <div className="d-flex align-items-center justify-content-center" style={{ height: "160px", background: "#f8f9fa", borderRadius: "8px" }}>
                  <Spinner animation="border" className="me-2" />
                  <span className="text-muted">Generating video...</span>
                </div>
              </>
            ) : (
              <>
                <h5 className="border-bottom pb-2">🔥 Instructions</h5>
                <p className="text-muted" style={{ whiteSpace: "pre-line" }}>
                  {recipe.steps || "No detailed steps provided."}
                </p>
              </>
            )}
          </Col>
        </Row>

        {shoppingList && shoppingList.length > 0 && (
          <Row className="mt-4">
            <Col>
              <h5 className="border-bottom pb-2">
                🧾 Missing ingredients
                {shoppingList?.length ? ` (${shoppingList.length})` : ""} (Smart Shopping List)
              </h5>
              <ul className="list-group list-group-flush">
                {shoppingList.map((item, idx) => (
                  <li
                    key={idx}
                    className="list-group-item bg-transparent px-0 text-danger fw-bold"
                  >
                    • {item.ingredient}
                  </li>
                ))}
              </ul>
            </Col>
          </Row>
        )}

        {cookingError && (
          <div className="alert alert-danger mt-3">{cookingError}</div>
        )}

        {cookingGuide && cookingGuide.enhanced_steps?.steps?.length > 0 && (
          <Row className="mt-4">
            <Col>
              <h5 className="border-bottom pb-2">📋 Detailed Steps</h5>
              {cookingGuide.enhanced_steps.steps.map((step, idx) => (
                <div key={idx} className="mb-3 p-3 border rounded">
                  <strong>Step {step.step_num}: {step.title}</strong>
                  <p className="mb-1 mt-1">{step.description}</p>
                  <small className="text-muted">💡 {step.tips} &nbsp;|&nbsp; ⏱️ {step.duration_minutes} min</small>
                </div>
              ))}
            </Col>
          </Row>
        )}
      </Modal.Body>

      <Modal.Footer className="border-0">
        <Button variant="outline-secondary" onClick={() => { setCookingGuide(null); setCookingError(null); handleClose(); }}>
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
          variant="outline-info"
          onClick={handleStartCookingClick}
          disabled={!(recipe.sourceUrl || recipe.url)}
        >
          View Recipe
        </Button>
        <Button
          variant="dark"
          onClick={handleGenerateVideo}
          disabled={cookingLoading}
        >
          {cookingLoading ? <><Spinner animation="border" size="sm" className="me-2" />Generating...</> : "Start Cooking"}
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
  const [hasStartedSearch, setHasStartedSearch] = useState(false);
  const [recipeOffset, setRecipeOffset] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const PAGE_SIZE = 16;

  // Shopping list
  const [shoppingList, setShoppingList] = useState([]);

  // Restaurants (Dine Out)
  const DEFAULT_DINE = { lat: 41.808, lng: -72.249 };
  const [restaurants, setRestaurants] = useState([]);
  const [resLoading, setResLoading] = useState(false);
  const [dineLat, setDineLat] = useState(DEFAULT_DINE.lat);
  const [dineLng, setDineLng] = useState(DEFAULT_DINE.lng);
  const [dineRadiusM, setDineRadiusM] = useState(2000);
  const [dineLocationLabel, setDineLocationLabel] = useState(
    "Mansfield, CT (default)"
  );
  const [dineLocMessage, setDineLocMessage] = useState("");
  const [dineAddressInput, setDineAddressInput] = useState("");
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [resSearchMessage, setResSearchMessage] = useState("");
  const [dineCustomCuisine, setDineCustomCuisine] = useState("");
  const [dineSortBy, setDineSortBy] = useState("distance");
  const [dinePriceFilter, setDinePriceFilter] = useState("all");

  // Favorites (persisted to localStorage)
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("smarteats_favorites") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("smarteats_favorites", JSON.stringify(favorites));
  }, [favorites]);

  const getFavKey = (recipe) =>
    String(recipe.sourceUrl || recipe.url || recipe.id || recipe.name || "");

  const isFavorited = (recipe) => {
    const key = getFavKey(recipe);
    return favorites.some((f) => getFavKey(f) === key);
  };

  const toggleFavorite = (recipe, e) => {
    e?.stopPropagation();
    const key = getFavKey(recipe);
    setFavorites((prev) =>
      prev.some((f) => getFavKey(f) === key)
        ? prev.filter((f) => getFavKey(f) !== key)
        : [...prev, recipe]
    );
  };

  // Vision scan modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState("");
  const webRecipeCacheRef = useRef(new Map());
  const activeRecommendControllerRef = useRef(null);
  const latestRecommendTokenRef = useRef(0);

  // Whenever pantry changes, refresh recommendations (after initial search)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasStartedSearch && pantry.length > 0) {
        setRecipeOffset(0);
        setRefreshCount(0);
        handleRecommend(pantry);
      } else if (!hasStartedSearch) {
        setRecipes([]);
        setRecipeOffset(0);
        setRefreshCount(0);
      }
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantry, hasStartedSearch]);

  useEffect(() => {
    return () => {
      if (activeRecommendControllerRef.current) {
        activeRecommendControllerRef.current.abort();
      }
    };
  }, []);

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
    const updated = pantry.filter((i) => i !== ingToRemove);
    setPantry(updated);
    // Reset search state if all ingredients are removed
    if (updated.length === 0) {
      setHasStartedSearch(false);
      setRecipes([]);
    }
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

  // Handle initial search start
  const handleStartSearch = () => {
    if (pantry.length > 0) {
      setHasStartedSearch(true);
      setRecipeOffset(0);
      setRefreshCount(0);
      handleRecommend(pantry);
    }
  };

  // Cycle to next batch; fetch new recipes when pool exhausted
  const handleRefreshRecipes = () => {
    const nextOffset = recipeOffset + PAGE_SIZE;
    if (nextOffset < recipes.length) {
      setRecipeOffset(nextOffset);
    } else {
      const newCount = refreshCount + 1;
      setRefreshCount(newCount);
      // Lower threshold progressively to surface more local recipes
      const threshold = Math.max(0.2, 0.5 - newCount * 0.1);
      // Advance Google CSE page to get genuinely new web results
      const webStart = (newCount * 10) + 1;
      setRecipeOffset(0);
      handleRecommend(pantry, { threshold, webStart });
    }
  };

  // Call /recipes/recommend + /recipes/search-web
  const handleRecommend = async (currentPantry, { threshold = 0.5, webStart = 1 } = {}) => {
    const requestToken = Date.now();
    latestRecommendTokenRef.current = requestToken;
    if (activeRecommendControllerRef.current) {
      activeRecommendControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeRecommendControllerRef.current = controller;

    const normalizedPantry = currentPantry
      .map((i) => normalizeIngredientText(i))
      .filter(Boolean);
    // Cache key includes webStart so different pages are stored separately
    const pantryKey = [...new Set(normalizedPantry)].sort().join("|") + `|p${webStart}`;

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/recipes/recommend`,
        {
          ingredients: currentPantry,
          threshold,
        },
        { signal: controller.signal }
      );
      let results = res.data.recipes || [];
      // Show fast local results first.
      setRecipes(results.slice(0, 50));

      // Web parsing is expensive: skip when pantry is too small.
      if (results.length < 50 && normalizedPantry.length >= 1) {
        const maxItems = 50;

        if (webRecipeCacheRef.current.has(pantryKey)) {
          const cachedWeb = webRecipeCacheRef.current.get(pantryKey) || [];
          const combinedCached = [...results, ...cachedWeb];
          const uniqueCached = new Map();
          combinedCached.forEach((item) => {
            const key = `${item.name}-${item.sourceUrl || item.url || item.id}`;
            if (!uniqueCached.has(key)) uniqueCached.set(key, item);
          });
          results = Array.from(uniqueCached.values()).slice(0, maxItems);
          if (latestRecommendTokenRef.current === requestToken) {
            setRecipes(results);
          }
          setLoading(false);
          return;
        }

        try {
          const webRes = await axios.post(
            `${API_BASE}/recipes/search-web`,
            {
              ingredients: currentPantry,
              start: webStart,
            },
            { signal: controller.signal }
          );

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
              id: `web-p${webStart}-${idx}`,
              name: item.name,
              cuisine: "Web Discovery",
              match_ratio: item.score || 0.6,
              required_ingredients: structuredIngredients,
              steps: firstInstruction || "Open source link for full recipe.",
              sourceUrl: item.url,
              image: item.image || null,
            };
          });
          webRecipeCacheRef.current.set(pantryKey, webItems);

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
          if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
            console.log("Web search failed", e);
          }
        }
      }

      const maxItems = 50;
      results = results.slice(0, maxItems);
      if (latestRecommendTokenRef.current === requestToken) {
        setRecipes(results);
      }
    } catch (err) {
      if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
        console.error("Recommend error:", err);
        setRecipes([]);
      }
    }
    if (latestRecommendTokenRef.current === requestToken) {
      setLoading(false);
    }
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

    const pantrySet = new Set(
      pantry.map((p) => normalizeIngredientText(p)).filter(Boolean)
    );
    const missing = required.filter((ing) => !hasPantryMatch(ing, pantrySet));

    const listItems = [];
    const seen = new Set();
    missing.forEach((name) => {
      const displayName = pickDisplayIngredient(name);
      if (!displayName || seen.has(displayName)) return;
      seen.add(displayName);
      listItems.push({
        ingredient: displayName,
      });
    });

    setShoppingList(listItems);
  };

  const useMyLocationForDineOut = () => {
    setDineLocMessage("");
    if (!navigator.geolocation) {
      setDineLocMessage("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDineLat(pos.coords.latitude);
        setDineLng(pos.coords.longitude);
        setDineLocationLabel("Your location");
      },
      () => {
        setDineLocMessage(
          "Could not read your location. Check browser permissions."
        );
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 }
    );
  };

  const resetDineLocation = () => {
    setDineLat(DEFAULT_DINE.lat);
    setDineLng(DEFAULT_DINE.lng);
    setDineLocationLabel("Mansfield, CT (default)");
    setDineAddressInput("");
    setDineLocMessage("");
  };

  const applyDineAddress = async () => {
    const q = dineAddressInput.trim();
    if (!q) {
      setDineLocMessage("Enter an address, neighborhood, or city.");
      return;
    }
    setGeocodeLoading(true);
    setDineLocMessage("");
    try {
      const res = await axios.get(`${API_BASE}/geocode`, {
        params: { address: q },
      });
      setDineLat(res.data.lat);
      setDineLng(res.data.lng);
      setDineLocationLabel(res.data.formatted_address || q);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        "Could not find that place. Try a fuller address.";
      setDineLocMessage(msg);
    } finally {
      setGeocodeLoading(false);
    }
  };

  // Call /restaurants/search
  const searchRestaurants = async (cuisineType) => {
    setResLoading(true);
    setRestaurants([]);
    setResSearchMessage("");
    try {
      const res = await axios.get(`${API_BASE}/restaurants/search`, {
        params: {
          cuisine: cuisineType,
          lat: dineLat,
          lng: dineLng,
          radius: dineRadiusM,
        },
      });
      const list = res.data.results || [];
      const st = res.data.places_status;
      const errMsg = res.data.places_error_message || "";
      setRestaurants(list);

      if (st === "NO_API_KEY") {
        setResSearchMessage(
          "Server has no GOOGLE_API_KEY. Add it to backend/.env and restart the API."
        );
      } else if (st && !["OK", "ZERO_RESULTS"].includes(st)) {
        setResSearchMessage(
          errMsg ||
            `Google returned “${st}”. In Google Cloud, enable Places API (New) — Text Search, and ensure billing is on.`
        );
      } else if (list.length === 0) {
        setResSearchMessage(
          "No restaurants in this radius. Try a larger radius, set a different address, or pick another cuisine."
        );
      }
    } catch (err) {
      console.error("Restaurant search error:", err);
      setRestaurants([]);
      setResSearchMessage(
        err.response?.data?.error?.message ||
          "Could not reach the server. Check that the backend is running."
      );
    }
    setResLoading(false);
  };

  const pantryCuisineHints = (() => {
    const p = new Set(pantry.map((x) => x.toLowerCase()));
    const add = [];
    const has = (terms) => terms.some((t) => p.has(t));
    if (has(["soy sauce", "ginger", "rice", "bok choy"])) add.push("Chinese");
    if (has(["pasta", "mozzarella", "basil", "tomato sauce"])) add.push("Italian");
    if (has(["tortilla", "lime", "cilantro"])) add.push("Mexican");
    if (has(["curry", "naan", "cumin"])) add.push("Indian");
    if (has(["soy sauce", "noodles", "dashi", "miso"])) add.push("Japanese");
    if (has(["fish sauce", "lemongrass", "coconut milk"])) add.push("Thai");
    return [...new Set(add)];
  })();

  const googlePlacesConsoleUrl = extractFirstHttpUrl(resSearchMessage);
  const showGooglePlacesSetupHint =
    Boolean(resSearchMessage) &&
    /Places API|not been used|it is disabled|PERMISSION_DENIED|enable it by visiting/i.test(
      resSearchMessage
    );

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
            className="rounded-pill px-4 me-2"
            onClick={() => setActiveTab("restaurants")}
          >
            🍔 Dine Out
          </Button>
          <Button
            variant={activeTab === "favorites" ? "danger" : "outline-secondary"}
            className="rounded-pill px-4 position-relative"
            onClick={() => setActiveTab("favorites")}
          >
            ❤️ Favorites
            {favorites.length > 0 && (
              <Badge
                bg="danger"
                className="position-absolute top-0 start-100 translate-middle rounded-pill"
                style={{ fontSize: "0.65rem" }}
              >
                {favorites.length}
              </Badge>
            )}
          </Button>
        </Nav>
      </Navbar>

      <Container fluid className="flex-grow-1">
        {activeTab === "pantry" ? (
          <Row className="h-100">
            {/* Left: Pantry */}
            <Col
              md={3}
              className="bg-white border-end d-flex flex-column"
              style={{ minHeight: "90vh", maxHeight: "90vh" }}
            >
              <div className="p-4 border-bottom">
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
              </div>

              {/* Scrollable Quick Add section */}
              <div className="flex-grow-1 overflow-auto p-4">
                <h6 className="text-muted text-uppercase small fw-bold mb-3">
                  Quick Add
                </h6>
                <div className="quick-add-container">
                  {Object.entries(COMMON_INGREDIENTS).map(([category, items]) => (
                    <div key={category} className="mb-3">
                      <h6 className="small text-muted fw-bold mb-2">{category}</h6>
                      <div className="d-flex flex-wrap gap-2">
                        {items.map((item) => (
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
                    </div>
                  ))}
                </div>
              </div>

            </Col>

            {/* Right: Recommended Recipes */}
            <Col md={9} className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  What you can make{recipes.length > 0
                    ? ` (${recipeOffset + 1}–${Math.min(recipeOffset + PAGE_SIZE, recipes.length)} of ${recipes.length})`
                    : ""}:
                </h5>
                <div className="d-flex align-items-center gap-2">
                  {hasStartedSearch && !loading && recipes.length > 0 && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="rounded-pill px-3"
                      onClick={handleRefreshRecipes}
                    >
                      🔄 {recipeOffset + PAGE_SIZE < recipes.length ? "Show More" : "Refresh"}
                    </Button>
                  )}
                  {loading && (
                    <Spinner animation="border" variant="danger" size="sm" />
                  )}
                </div>
              </div>

              {!hasStartedSearch && pantry.length > 0 && (
                <div 
                  className="text-center mb-5" 
                  style={{ 
                    minHeight: '800px',
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <h4 style={{ fontSize: "1.5rem", color: "#999", marginBottom: '1rem' }}>📝</h4>
                  <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                    Add ingredients to your pantry to see recipes!
                  </p>
                  <Button
                    variant="success"
                    size="lg"
                    style={{ minWidth: '220px' }}
                    onClick={handleStartSearch}
                  >
                    🔍 Search Recipes
                  </Button>
                </div>
              )}

              <div
                className="recipe-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "1rem",
                }}
              >
                {recipes.slice(recipeOffset, recipeOffset + PAGE_SIZE).map((recipe) => {
                  const cardImage = recipe.image
                    ? recipe.image
                    : `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(
                        recipe.name
                      )}&font=roboto`;

                  return (
                      <Card
                        key={recipe.id || recipe.name}
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
                            height: "240px",
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
                              height: "240px",
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
                          <button
                            onClick={(e) => toggleFavorite(recipe, e)}
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: "8px",
                              background: "rgba(255,255,255,0.85)",
                              border: "none",
                              borderRadius: "50%",
                              width: "32px",
                              height: "32px",
                              cursor: "pointer",
                              fontSize: "1rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                            }}
                            title={isFavorited(recipe) ? "Remove from favorites" : "Add to favorites"}
                          >
                            {isFavorited(recipe) ? "❤️" : "🤍"}
                          </button>
                        </div>

                        <Card.Body>
                          <Card.Title className="h5 fw-bold text-truncate">
                            {recipe.name}
                          </Card.Title>
                          <Card.Text className="text-muted" style={{ fontSize: '0.95rem' }}>
                            {recipe.cuisine || "Recipe"}
                          </Card.Text>
                        </Card.Body>
                      </Card>
                  );
                })}
              </div>
            </Col>
          </Row>
        ) : activeTab === "favorites" ? (
          <Container className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="mb-0 fw-bold">❤️ Favorite Recipes ({favorites.length})</h4>
              {favorites.length > 0 && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="rounded-pill"
                  onClick={() => setFavorites([])}
                >
                  Clear All
                </Button>
              )}
            </div>

            {favorites.length === 0 ? (
              <div className="text-center text-muted py-5">
                <p style={{ fontSize: "3rem" }}>🤍</p>
                <p>No favorites yet. Tap the heart on any recipe to save it here.</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "1rem",
                }}
              >
                {favorites.map((recipe) => {
                  const cardImage = recipe.image
                    ? recipe.image
                    : `https://placehold.co/600x400/EEE/31343C?text=${encodeURIComponent(
                        recipe.name
                      )}&font=roboto`;

                  return (
                    <Card
                      key={getFavKey(recipe)}
                      className="border-0 shadow-sm h-100 recipe-card"
                      style={{ cursor: "pointer", transition: "0.2s" }}
                      onClick={() => {
                        setSelectedRecipe(recipe);
                        setShoppingList([]);
                      }}
                    >
                      <div style={{ height: "240px", overflow: "hidden", position: "relative" }}>
                        <Card.Img
                          variant="top"
                          src={cardImage}
                          style={{ objectFit: "cover", height: "240px", width: "100%" }}
                        />
                        <button
                          onClick={(e) => toggleFavorite(recipe, e)}
                          style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            background: "rgba(255,255,255,0.85)",
                            border: "none",
                            borderRadius: "50%",
                            width: "32px",
                            height: "32px",
                            cursor: "pointer",
                            fontSize: "1rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                          }}
                          title="Remove from favorites"
                        >
                          ❤️
                        </button>
                        {typeof recipe.match_ratio === "number" && (
                          <Badge
                            bg={recipe.match_ratio === 1 ? "success" : "warning"}
                            className="position-absolute top-0 end-0 m-2 shadow-sm"
                          >
                            Match: {Math.round(recipe.match_ratio * 100)}%
                          </Badge>
                        )}
                      </div>
                      <Card.Body>
                        <Card.Title className="h5 fw-bold text-truncate">{recipe.name}</Card.Title>
                        <Card.Text className="text-muted" style={{ fontSize: "0.95rem" }}>
                          {recipe.cuisine || "Recipe"}
                        </Card.Text>
                      </Card.Body>
                    </Card>
                  );
                })}
              </div>
            )}
          </Container>
        ) : (
          <Container className="py-5">
            <div className="text-center mb-4">
              <h2 className="fw-bold">Find Nearby Restaurants</h2>
              <p className="text-muted mb-2">
                Searching near{" "}
                <span className="text-dark fw-semibold">
                  {dineLocationLabel}
                </span>
                {" · "}
                within {(dineRadiusM / 1000).toFixed(1)} km
              </p>
            </div>

            <Row className="mb-4 g-3 align-items-stretch">
              <Col lg={5}>
                <Card className="border-0 shadow-sm h-100">
                  <Card.Body>
                    <h6 className="fw-bold mb-3">Location</h6>
                    <Form
                      className="mb-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        applyDineAddress();
                      }}
                    >
                      <Form.Label className="small text-muted">
                        Address or place (Geocoding)
                      </Form.Label>
                      <div className="d-flex gap-2 flex-column flex-sm-row">
                        <Form.Control
                          type="text"
                          placeholder="e.g. 123 Main St, Boston MA"
                          value={dineAddressInput}
                          onChange={(e) => setDineAddressInput(e.target.value)}
                        />
                        <Button
                          type="submit"
                          variant="danger"
                          className="flex-shrink-0"
                          disabled={geocodeLoading}
                        >
                          {geocodeLoading ? "…" : "Set"}
                        </Button>
                      </div>
                    </Form>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="rounded-pill"
                        onClick={useMyLocationForDineOut}
                      >
                        📍 My location
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="rounded-pill"
                        onClick={resetDineLocation}
                      >
                        Default (Mansfield)
                      </Button>
                    </div>
                    <Form.Label className="small text-muted">Radius</Form.Label>
                    <Form.Select
                      size="sm"
                      className="mb-2"
                      value={dineRadiusM}
                      onChange={(e) =>
                        setDineRadiusM(Number.parseInt(e.target.value, 10))
                      }
                      aria-label="Search radius"
                    >
                      <option value={1000}>1 km</option>
                      <option value={2000}>2 km</option>
                      <option value={5000}>5 km</option>
                      <option value={10000}>10 km</option>
                      <option value={20000}>20 km</option>
                    </Form.Select>
                    {dineLocMessage && (
                      <p className="small text-warning mb-0">{dineLocMessage}</p>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={7}>
                <RestaurantMap
                  centerLat={dineLat}
                  centerLng={dineLng}
                  radiusM={dineRadiusM}
                  restaurants={restaurants}
                />
                <p className="small text-muted mt-2 mb-0 text-center">
                  Map tiles © OpenStreetMap · Red circle = search radius
                </p>
              </Col>
            </Row>

            {/* Cuisine selector */}
            <div className="text-center mb-4">
              {pantryCuisineHints.length > 0 && (
                <p className="small text-muted mb-3">
                  From your pantry, try:{" "}
                  {pantryCuisineHints.map((c) => (
                    <Button
                      key={c}
                      variant="link"
                      className="p-0 me-2 small"
                      onClick={() => searchRestaurants(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </p>
              )}
              <div className="d-flex justify-content-center gap-2 mt-2 flex-wrap mb-3">
                {[
                  "Italian", "Chinese", "Japanese", "American",
                  "Mexican", "Thai", "Indian", "Korean", "Vietnamese", "Mediterranean",
                ].map((c) => (
                  <Button
                    key={c}
                    variant="outline-danger"
                    className="rounded-pill px-3"
                    onClick={() => searchRestaurants(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
              {/* Custom cuisine input */}
              <Form
                className="d-flex justify-content-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = dineCustomCuisine.trim();
                  if (q) searchRestaurants(q);
                }}
              >
                <Form.Control
                  type="text"
                  placeholder="Search any cuisine…"
                  value={dineCustomCuisine}
                  onChange={(e) => setDineCustomCuisine(e.target.value)}
                  style={{ maxWidth: 260 }}
                  className="rounded-pill"
                />
                <Button
                  type="submit"
                  variant="danger"
                  className="rounded-pill px-4"
                  disabled={!dineCustomCuisine.trim()}
                >
                  Search
                </Button>
              </Form>
            </div>

            {/* Sort & price filter — only shown once results exist */}
            {restaurants.length > 0 && !resLoading && (
              <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between mb-3 px-1">
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-muted fw-semibold">Sort:</span>
                  {[
                    { key: "distance", label: "📍 Distance" },
                    { key: "rating", label: "⭐ Rating" },
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={dineSortBy === key ? "danger" : "outline-secondary"}
                      className="rounded-pill"
                      onClick={() => setDineSortBy(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-muted fw-semibold">Price:</span>
                  {["all", "$", "$$", "$$$", "$$$$"].map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={dinePriceFilter === p ? "danger" : "outline-secondary"}
                      className="rounded-pill"
                      onClick={() => setDinePriceFilter(p)}
                    >
                      {p === "all" ? "All" : p}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {resLoading && (
              <div className="text-center py-5">
                <Spinner animation="border" variant="danger" />
              </div>
            )}

            {resSearchMessage && !resLoading && (
              <div
                className={`alert mx-auto mb-4 ${
                  showGooglePlacesSetupHint
                    ? "alert-warning text-start"
                    : "alert-light border text-center text-muted"
                } small`}
                style={{ maxWidth: 720 }}
              >
                {showGooglePlacesSetupHint && (
                  <div className="mb-3">
                    <p className="fw-bold mb-1">
                      The Google Cloud API needs to be enabled (not a code error)
                    </p>
                    <p className="mb-0 text-dark">
                      The{" "}
                      <strong>Places API (New)</strong> is not enabled for this project. Click the button below to open the console →
                      click <strong>Enable</strong> → wait 1–3 minutes, then search again.
                    </p>
                  </div>
                )}
                <p
                  className={`mb-0 ${showGooglePlacesSetupHint ? "text-break text-secondary" : ""}`}
                >
                  {resSearchMessage}
                </p>
                {showGooglePlacesSetupHint && googlePlacesConsoleUrl && (
                  <div className="mt-3">
                    <Button
                      variant="danger"
                      size="sm"
                      className="me-2"
                      href={googlePlacesConsoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Google Cloud Console
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Row>
              {(() => {
                let list = [...restaurants];
                // Price filter
                if (dinePriceFilter !== "all") {
                  list = list.filter((r) => r.price_label === dinePriceFilter);
                }
                // Sort
                if (dineSortBy === "rating") {
                  list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                } else {
                  list.sort((a, b) => (a.distance_km || 9999) - (b.distance_km || 9999));
                }
                return list.map((res, idx) => (
                  <Col md={4} key={res.place_id || idx} className="mb-4">
                    <Card className="border-0 shadow h-100">
                      {/* Photo */}
                      {res.photo_url ? (
                        <Card.Img
                          variant="top"
                          src={res.photo_url}
                          style={{ height: "160px", objectFit: "cover" }}
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div
                          style={{
                            height: "160px",
                            background: "linear-gradient(135deg,#f5f5f5,#e0e0e0)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "2.5rem",
                          }}
                        >
                          🍽️
                        </div>
                      )}
                      <Card.Body className="d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                          <h5 className="fw-bold mb-0" style={{ fontSize: "1rem" }}>{res.name}</h5>
                          <div className="text-end flex-shrink-0">
                            {res.rating != null && res.rating > 0 && (
                              <Badge bg="warning" text="dark" className="me-1">
                                ⭐ {res.rating}
                              </Badge>
                            )}
                            {res.price_label ? (
                              <Badge bg="secondary">{res.price_label}</Badge>
                            ) : null}
                          </div>
                        </div>

                        {res.user_ratings_total != null && res.user_ratings_total > 0 && (
                          <p className="small text-muted mb-1">
                            {res.user_ratings_total.toLocaleString()} reviews
                          </p>
                        )}

                        <p className="small text-muted mb-2">
                          📍 {res.address || res.vicinity}
                        </p>

                        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                          {typeof res.distance_km === "number" && (
                            <Badge bg="light" text="dark" className="border">
                              {res.distance_km < 1
                                ? `${Math.round(res.distance_km * 1000)} m`
                                : `${res.distance_km} km`}
                            </Badge>
                          )}
                          {res.open_now === true && <Badge bg="success">Open now</Badge>}
                          {res.open_now === false && <Badge bg="secondary">Closed</Badge>}
                        </div>

                        {res.phone && (
                          <p className="small mb-1">
                            📞{" "}
                            <a href={`tel:${res.phone}`} className="text-decoration-none text-dark">
                              {res.phone}
                            </a>
                          </p>
                        )}

                        {res.website && (
                          <p className="small mb-2 text-truncate">
                            🌐{" "}
                            <a
                              href={res.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none"
                            >
                              {res.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                            </a>
                          </p>
                        )}

                        {res.maps_url && (
                          <div className="mt-auto pt-2">
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="rounded-pill"
                              href={res.maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Directions / Maps
                            </Button>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                ));
              })()}
              {!resLoading && restaurants.length === 0 && !resSearchMessage && (
                <div className="text-center text-muted w-100 py-5">
                  Choose a cuisine above or type a custom one to search.
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