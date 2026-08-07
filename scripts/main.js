document.addEventListener("DOMContentLoaded", function () {
  const reveals = document.querySelectorAll(".reveal-animate");

  function reveal() {
    for (let i = 0; i < reveals.length; i++) {
      const windowHeight = window.innerHeight;
      const elementTop = reveals[i].getBoundingClientRect().top;
      const elementVisible = 100;

      if (elementTop < windowHeight - elementVisible) {
        reveals[i].classList.add("is-visible");
      } else {
        reveals[i].classList.remove("is-visible");
      }
    }
  }

  lucide.createIcons();

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

  const link = document.getElementById("gradiate-link");
  if (/android/i.test(userAgent)) {
    link.href = "https://play.google.com/store/apps/details?id=com.ruskcoder.gradiate";
  } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    link.href = "https://apps.apple.com/us/app/gradiate/id6745531312";
  }

  const desktopButtons = document.querySelector(".install__buttons--desktop");
  const mobileButtons = document.querySelector(".install__buttons--mobile");

  if (isMobile) {
    desktopButtons.style.display = "none";
    mobileButtons.style.display = "flex";
  } else {
    desktopButtons.style.display = "flex";
    mobileButtons.style.display = "none";
  }

  const themeToggle = document.getElementById('theme-toggle');

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });

  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');

    if (document.documentElement.classList.contains('dark')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  });

  document.querySelectorAll('.carousel-container').forEach(container => {
    const track = container.querySelector('.carousel-track');
    const prev = container.querySelector('.prev');
    const next = container.querySelector('.next');
    let position = 0;
    const cardWidth = container.querySelector('.feature-card, .review-card').offsetWidth;
    const gap = 32; 

    const visibleCards = 3;
    const totalCards = track.children.length;
    const maxPosition = -(totalCards - visibleCards) * (cardWidth + gap);

    function updateButtons() {
      prev.style.opacity = position === 0 ? '0.5' : '1';
      next.style.opacity = position <= maxPosition ? '0.5' : '1';
    }

    function slide(direction) {
      const shift = direction * (cardWidth + gap);
      position = Math.max(Math.min(position + shift, 0), maxPosition);
      track.style.transform = `translateX(${position}px)`;
      updateButtons();
    }
    prev.addEventListener('click', () => slide(1));
    next.addEventListener('click', () => slide(-1));

    updateButtons();
  });

  window.addEventListener("scroll", reveal);
  reveal();

  function updateSwiperScales(swiper, isDragging = false) {
    const slides = swiper.slides;
    const wrapper = swiper.wrapperEl;
    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = swiper.el.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    slides.forEach((slide) => {
      const slideRect = slide.getBoundingClientRect();
      const slideCenter = slideRect.left + slideRect.width / 2;

      const distanceFromCenter = Math.abs(slideCenter - containerCenter);
      const slideWidth = slideRect.width;

      const normalizedDistance = Math.min(distanceFromCenter / (slideWidth * 1.5), 1);

      const scale = 1.1 - (normalizedDistance * 0.1);

      if (isDragging) {
        slide.style.transition = 'none'; 

      } else {
        slide.style.transition = 'transform 0.3s ease-out';
      }
      slide.style.transform = `scale(${scale})`;
    });
  }

  function observeSwiperWrapper(swiper) {
    const wrapper = swiper.wrapperEl;
    let isTransitioning = false;
    let animationFrameId = null;

    const smoothTransitionUpdate = () => {
      updateSwiperScales(swiper, true);
      if (isTransitioning) {
        animationFrameId = requestAnimationFrame(smoothTransitionUpdate);
      }
    };

    const observer = new MutationObserver(() => {
      // Only update on drag, not during transitions
      if (!isTransitioning) {
        updateSwiperScales(swiper, true);
      }
    });

    observer.observe(wrapper, {
      attributes: true,
      attributeFilter: ['style']
    });

    swiper.on('transitionStart', () => {
      isTransitioning = true;
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(smoothTransitionUpdate);
      }
    });

    swiper.on('transitionEnd', () => {
      isTransitioning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      updateSwiperScales(swiper, false);
    });
  }

  var swiperApp = new Swiper('[data-carousel="app"]', {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    centeredSlides: true,
    grabCursor: true,
    initialSlide: 4,
    pagination: {
      el: '[data-carousel="app"] .swiper-pagination',
      clickable: true,
    },
    autoplay: {
      delay: 2500,
      disableOnInteraction: false,
    },
    breakpoints: {
      320: {
        slidesPerView: 1,
        spaceBetween: 30,
      },
      500: {
        slidesPerView: 3,
        spaceBetween: 0,
      },
      800: {
        slidesPerView: 5,
        spaceBetween: 20,
      },
    },
    on: {
      init: function(swiper) {
        updateSwiperScales(swiper, false);
        observeSwiperWrapper(swiper);
      },
      touchEnd: function(swiper) {
        updateSwiperScales(swiper, false);
      },
      slideChange: function(swiper) {
        updateSwiperScales(swiper, false);
      }
    }
  });

  var swiperWebsite = new Swiper('[data-carousel="website"]', {
    slidesPerView: 0.85,
    spaceBetween: 0,
    loop: true,
    centeredSlides: true,
    grabCursor: true,
    pagination: {
      el: '[data-carousel="website"] .swiper-pagination',
      clickable: true,
    },
    autoplay: {
      delay: 2500,
      disableOnInteraction: false,
    },
    breakpoints: {
      600: {
        slidesPerView: 1.75,
        spaceBetween: 30,
      },
      800: {
        slidesPerView: 1.75,
        spaceBetween: 30,
      },
    },
    on: {
      init: function(swiper) {
        updateSwiperScales(swiper, false);
        observeSwiperWrapper(swiper);
      },
      touchEnd: function(swiper) {
        updateSwiperScales(swiper, false);
      },
      slideChange: function(swiper) {
        updateSwiperScales(swiper, false);
      }
    }
  });

  const tabButtons = document.querySelectorAll(".screenshots__tab");
  const appCarousel = document.querySelector('[data-carousel="app"]');
  const websiteCarousel = document.querySelector('[data-carousel="website"]');
  let currentTab = "website";
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const newTab = button.dataset.tab;
      if (newTab === currentTab) return;

      currentTab = newTab;

      tabButtons.forEach(btn => btn.classList.remove("screenshots__tab--active"));
      button.classList.add("screenshots__tab--active");

      if (currentTab === "app") {
        appCarousel.style.display = "block";
        websiteCarousel.style.display = "none";
        swiperApp.update();
      } else {
        appCarousel.style.display = "none";
        websiteCarousel.style.display = "block";
        swiperWebsite.update();
      }
    });
  });

  const platformSections = document.querySelectorAll(".platform-card");
  platformSections.forEach(section => {
    section.addEventListener("click", () => {
      const platform = section.dataset.platform;
      const tabToActivate = platform === "website" ? "website" : "app";

      const tabToClick = document.querySelector(`.screenshots__tab[data-tab="${tabToActivate}"]`);
      if (tabToClick) {
        tabToClick.click();
      }

      const screenshotsSection = document.querySelector(".screenshots-section");
      if (screenshotsSection) {
        setTimeout(() => {
          screenshotsSection.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    });
  })
});