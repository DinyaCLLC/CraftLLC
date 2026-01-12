document.addEventListener('DOMContentLoaded', function() {
    return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const noSnow = urlParams.get('noSnow') === 'true';

    if (noSnow) {
        return; // Don't create snow if noSnow=true is in the URL
    }

    const today = new Date();
    const month = today.getMonth();

    // Check if it's winter (December, January, or February)
    if (month === 11 || month === 0 || month === 1) {
        createSnowfall();
    }
});

function createSnowfall() {
    const snowfallContainer = document.createElement('div');
    snowfallContainer.id = 'snowfall-container';
    snowfallContainer.style.position = 'fixed';
    snowfallContainer.style.top = '0';
    snowfallContainer.style.left = '0';
    snowfallContainer.style.width = '100%';
    snowfallContainer.style.height = '100%';
    snowfallContainer.style.pointerEvents = 'none';
    snowfallContainer.style.zIndex = '9999';
    document.body.appendChild(snowfallContainer);

    for (let i = 0; i < 150; i++) {
        createSnowflake(snowfallContainer);
    }
}

function createSnowflake(container) {
    const fallContainer = document.createElement('div');
    fallContainer.style.position = 'absolute';
    const size = Math.random() * 15 + 10;
    fallContainer.style.left = `${Math.random() * 100}%`;
    fallContainer.style.top = `${-size*2}px`; // Start above the screen

    const snowflake = document.createElement('div');
    snowflake.innerHTML = '❄';
    snowflake.style.userSelect = 'none';
    snowflake.style.fontSize = `${size}px`;
    
    fallContainer.appendChild(snowflake);

    const animationDuration = Math.random() * 10 + 8; // 8 to 18 seconds
    const animationDelay = Math.random() * 15;
    
    fallContainer.style.animation = `fall ${animationDuration}s linear ${animationDelay}s infinite`;
    
    // Horizontal sway
    const swayType = Math.random() > 0.5 ? 'sway-left-right' : 'sway-right-left';
    const swayDuration = Math.random() * 4 + 3; // 3 to 7 seconds
    snowflake.style.animation = `${swayType} ${swayDuration}s ease-in-out ${animationDelay}s infinite alternate`;

    container.appendChild(fallContainer);
}

// Add keyframes to the document's head
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes fall {
    to {
        transform: translateY(110vh);
    }
}

@keyframes sway-left-right {
    from {
        transform: translateX(0px);
    }
    to {
        transform: translateX(60px);
    }
}

@keyframes sway-right-left {
    from {
        transform: translateX(0px);
    }
    to {
        transform: translateX(-60px);
    }
}
`;
document.head.appendChild(styleSheet);