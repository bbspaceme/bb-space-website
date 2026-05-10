/**
 * Landing Page Global Styles
 * Animations, keyframes, and utility styles for landing components
 */

export const globalStyles = `
  /* ══ ANIMATIONS ══ */
  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideInFromLeft {
    from {
      opacity: 0;
      transform: translateX(-50px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideInFromRight {
    from {
      opacity: 0;
      transform: translateX(50px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes scrollLeft {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-100%);
    }
  }

  @keyframes glow {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }

  @keyframes drawLine {
    from {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
    }
    to {
      stroke-dasharray: 1000;
      stroke-dashoffset: 0;
    }
  }

  /* ══ UTILITY CLASSES ══ */
  .reveal {
    animation: fadeUp 0.6s ease-out 0s forwards;
    opacity: 0;
  }

  .reveal.in {
    opacity: 1;
  }

  .hover-lift {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .hover-lift:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .focus-ring:focus {
    outline: 2px solid #22C55E;
    outline-offset: 2px;
  }

  .pointer-none {
    pointer-events: none;
  }

  .pointer-auto {
    pointer-events: auto;
  }

  .truncate-line {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .truncate-lines-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

export const cssModule = `
/* Landing page animations module */

.fadeUp {
  animation: fadeUp 0.6s ease-out forwards;
}

.slideInLeft {
  animation: slideInFromLeft 0.8s ease-out forwards;
}

.slideInRight {
  animation: slideInFromRight 0.8s ease-out forwards;
}

.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.scrollLeft {
  animation: scrollLeft 20s linear infinite;
}

.glow {
  animation: glow 3s ease-in-out infinite;
}

.shimmer {
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}

.drawLine {
  animation: drawLine 1s ease-out forwards;
}
`;
