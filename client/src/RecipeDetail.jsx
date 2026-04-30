import React, { useState } from 'react';
import './RecipeDetail.css';

export function RecipeDetail({ recipe, show, onHide }) {
  const [cooking, setCooking] = useState(false);
  const [cookingGuide, setCookingGuide] = useState(null);
  const [error, setError] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const handleStartCooking = async () => {
    setCooking(true);
    setError(null);
    setVideoLoading(true);

    try {
      const response = await fetch('http://localhost:5001/api/generate-cooking-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_name: recipe.name || 'Unknown Recipe',
          ingredients: recipe.required_ingredients || [],
          steps: recipe.steps ? [recipe.steps] : []
        })
      });

      const data = await response.json();
      if (data.success) {
        setCookingGuide(data);
      } else {
        setError(data.error || 'Failed to generate tutorial video, please try again');
      }
    } catch (err) {
      setError('Request failed: ' + err.message);
    } finally {
      setCooking(false);
      setVideoLoading(false);
    }
  };

  if (!recipe || !show) return null;

  // Show cooking guide view
  if (cookingGuide) {
    const guide = cookingGuide.enhanced_steps;

    return (
      <div className="modal-overlay" onClick={onHide}>
        <div className="modal-content recipe-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">🎬 {recipe.name} - Cooking Guide</h2>
            <button className="close-btn" onClick={onHide}>×</button>
          </div>

          <div className="modal-body">
            {videoLoading && (
              <div className="alert alert-info">
                <span className="spinner"></span>
                Generating video, please wait...
              </div>
            )}

            {/* Tutorial video */}
            <div className="video-section">
              <h5>📹 Tutorial Video</h5>
              <video
                width="100%"
                height="400"
                controls
                className="recipe-video"
                onLoadStart={() => setVideoLoading(true)}
                onCanPlay={() => setVideoLoading(false)}
              >
                <source src={`http://localhost:5001${cookingGuide.video_url}`} type="video/mp4" />
                Your browser does not support video playback
              </video>
            </div>

            {/* Cooking overview */}
            <div className="cooking-overview">
              <div className="overview-item">
                <span className="overview-label">⏱️ Total Time</span>
                <strong className="overview-value">{guide.total_time_minutes}</strong>
                <span className="overview-label">min</span>
              </div>
              <div className="overview-item">
                <span className="overview-label">📊 Difficulty</span>
                <strong className="overview-value">
                  {guide.difficulty === 'easy' ? '⭐ Easy' :
                   guide.difficulty === 'medium' ? '⭐⭐ Medium' :
                   '⭐⭐⭐ Hard'}
                </strong>
              </div>
            </div>

            {/* Detailed steps */}
            <h5>📋 Detailed Steps</h5>
            <div className="steps-container">
              {guide.steps && guide.steps.map((step, idx) => (
                <div key={idx} className="step-card">
                  <div className="step-header">
                    <div>
                      <h6>
                        <span className="step-number">Step {step.step_num}</span>
                        <strong>{step.title}</strong>
                      </h6>
                    </div>
                    <span className="step-duration">{step.duration_minutes} min</span>
                  </div>

                  <p className="step-description">{step.description}</p>

                  <div className="step-details">
                    <small>
                      <strong className="step-label">💡 Tip:</strong>
                      <span>{step.tips}</span>
                    </small>
                    <small>
                      <strong className="step-label">🔧 Tools:</strong>
                      <span>{step.tools && step.tools.join(', ')}</span>
                    </small>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn btn-outline"
              onClick={() => setCookingGuide(null)}
            >
              ← Back to Recipe
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show original recipe detail
  return (
    <div className="modal-overlay" onClick={onHide}>
      <div className="modal-content recipe-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{recipe.name}</h2>
          <button className="close-btn" onClick={onHide}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <h5 className="section-title">🥘 Ingredients ({recipe.required_ingredients?.length || 0})</h5>
          {recipe.required_ingredients && recipe.required_ingredients.length > 0 ? (
            <ul className="ingredients-list">
              {recipe.required_ingredients.map((ing, idx) => (
                <li key={idx} className="ingredient-item">✓ {ing}</li>
              ))}
            </ul>
          ) : (
            <div className="alert alert-light">No ingredients available</div>
          )}

          {recipe.steps && (
            <>
              <h5 className="section-title">👨‍🍳 Cooking Steps</h5>
              <p className="recipe-steps">{recipe.steps}</p>
            </>
          )}

          {recipe.cuisine && (
            <div className="recipe-meta">
              <span className="badge">🍜 {recipe.cuisine}</span>
            </div>
          )}

          <button
            className="btn btn-success"
            onClick={handleStartCooking}
            disabled={cooking}
          >
            {cooking ? 'Generating video...' : '🚀 Start Cooking - Generate AI Tutorial'}
          </button>
        </div>
      </div>
    </div>
  );
}
