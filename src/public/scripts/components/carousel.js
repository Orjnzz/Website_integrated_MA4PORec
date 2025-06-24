const wrapper = document.querySelector(".wrapper-carousel");
const carousel = document.querySelector(".carousel");
const firstCardWidth = carousel.querySelector(".carousel__card").offsetWidth;
const arrowBtns = document.querySelectorAll(".wrapper-carousel .arrow");
const carouselChildrens = [...carousel.children];
let isDragging = false, isAutoPlay = true, startX, startScrollLeft, timeoutId;

// Tracking function to track product clicks
function trackProductClick(productVariantId, categoryId, productName) {
    if (!productVariantId) return;
    
    try {
        // Retrieve the current session's clicked products
        let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

        // Thêm thông tin sản phẩm vào danh sách nếu chưa có
        const productInfo = {
            product_variant_id: productVariantId,
            category_id: categoryId,
            product_name: productName, // Thêm trường product_name
            sended: false // Thêm trường sended mặc định là false
        };

        // Kiểm tra xem sản phẩm đã được click chưa (dựa trên product_variant_id)
        if (!clickedProducts.some(item => item.product_variant_id === productVariantId)) {
            clickedProducts.push(productInfo);
            // Save the updated list back to local storage
            localStorage.setItem('clickedProducts', JSON.stringify(clickedProducts));
            console.log('Tracked outstanding product:', productVariantId, 'in category:', categoryId, 'name:', productName);
        }
    } catch (error) {
        console.error('Error tracking product:', error);
    }
}

// Add tracking for carousel__card-main links
document.addEventListener('DOMContentLoaded', function() {
    // Track clicks on carousel__card-main links
    document.querySelectorAll('.carousel__card-main').forEach((productLink) => {
        productLink.addEventListener('click', function() {
            // Lấy product_variant_id từ URL của thẻ a
            const href = this.getAttribute('href');
            if (href && href.includes('/')) {
                const productVariantId = href.split('/')[2].split('?')[0];
                const categoryId = new URLSearchParams(href.split('?')[1]).get('category_id');
                
                // Lấy product_name từ thẻ h4 (có thể ở dạng đầy đủ trong title hoặc bị cắt ngắn trong nội dung)
                const productNameElement = this.querySelector('h4');
                // Ưu tiên lấy từ thuộc tính title khi tên sản phẩm bị cắt ngắn
                const productName = productNameElement && productNameElement.getAttribute('title') 
                    ? productNameElement.getAttribute('title') 
                    : (productNameElement ? productNameElement.textContent.trim() : 'Unknown Product');
                
                trackProductClick(productVariantId, categoryId, productName);
            }
        });
    });

    // Lấy danh sách sản phẩm đã click từ localStorage
    let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];
    
    // // DEBUGGING: Log tracked products to console when page loads
    // console.log('===== TRACKING DEBUGGING (carousel products) =====');
    // console.log('Products tracked in this session:', clickedProducts);
    // console.log('=======================================');

    // Đã loại bỏ phần gửi dữ liệu đến server - chỉ gửi khi người dùng quay về trang chủ
});

// Get the number of cards that can fit in the carousel at once
let cardPerView = Math.round(carousel.offsetWidth / firstCardWidth);
// Insert copies of the last few cards to beginning of carousel for infinite scrolling
carouselChildrens.slice(-cardPerView).reverse().forEach(card => {
    carousel.insertAdjacentHTML("afterbegin", card.outerHTML);
});
// Insert copies of the first few cards to end of carousel for infinite scrolling
carouselChildrens.slice(0, cardPerView).forEach(card => {
    carousel.insertAdjacentHTML("beforeend", card.outerHTML);
});
// Scroll the carousel at appropriate postition to hide first few duplicate cards on Firefox
carousel.classList.add("no-transition");
carousel.scrollLeft = carousel.offsetWidth;
carousel.classList.remove("no-transition");
// Add event listeners for the arrow buttons to scroll the carousel left and right
arrowBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        carousel.scrollLeft += btn.id == "left" ? -firstCardWidth : firstCardWidth;
    });
});

const dragStart = (e) => {
    isDragging = true;
    carousel.classList.add("dragging");
    // Records the initial cursor and scroll position of the carousel
    startX = e.pageX;
    startScrollLeft = carousel.scrollLeft;
}
const dragging = (e) => {
    if (!isDragging) return; // if isDragging is false return from here
    // Updates the scroll position of the carousel based on the cursor movement
    carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
}
const dragStop = () => {
    isDragging = false;
    carousel.classList.remove("dragging");
}
const infiniteScroll = () => {
    // If the carousel is at the beginning, scroll to the end
    if (carousel.scrollLeft === 0) {
        carousel.classList.add("no-transition");
        carousel.scrollLeft = carousel.scrollWidth - (2 * carousel.offsetWidth);
        carousel.classList.remove("no-transition");
    }
    // If the carousel is at the end, scroll to the beginning
    else if ((Math.ceil(carousel.scrollLeft) === carousel.scrollWidth - carousel.offsetWidth)
        || (Math.ceil(carousel.scrollLeft) - 1 === carousel.scrollWidth - carousel.offsetWidth)) {
        carousel.classList.add("no-transition");
        carousel.scrollLeft = carousel.offsetWidth;
        carousel.classList.remove("no-transition");
    }
    // Clear existing timeout & start autoplay if mouse is not hovering over carousel
    clearTimeout(timeoutId);
    if (!wrapper.matches(":hover")) autoPlay();
}

const autoPlay = () => {
    if (window.innerWidth < 800 || !isAutoPlay) return; // Return if window is smaller than 800 or isAutoPlay is false
    // Autoplay the carousel after every 2500 ms
    timeoutId = setTimeout(() => carousel.scrollLeft += firstCardWidth, 1500);
}
autoPlay();
carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("mousemove", dragging);
document.addEventListener("mouseup", dragStop);
carousel.addEventListener("scroll", infiniteScroll);
wrapper.addEventListener("mouseenter", () => clearTimeout(timeoutId));
wrapper.addEventListener("mouseleave", autoPlay);