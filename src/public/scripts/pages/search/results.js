const product = require("../../../../models/customer/product.model");

// Thêm "active" vào app-bar__element
const appbarEle = document.querySelectorAll('.app-bar__element')
appbarEle[2].classList.add('active')

const filterItems = document.querySelectorAll('.seacrh-result__filter-normal__content');

let selectedFilterItem = null;

filterItems.forEach(item => {
    item.addEventListener('click', () => {
        // Ẩn dropdown-content của thành phần trước đó (nếu có)
        if (selectedFilterItem) {
            const prevDropdownContent = selectedFilterItem.querySelector('.dropdown-content');
            prevDropdownContent.style.display = 'none';
        }

        // Đặt lại màu viền cho tất cả các thành phần
        filterItems.forEach(originalItem => {
            originalItem.style.borderColor = '';
            originalItem.style.color = '';
        });

        // Thiết lập màu viền xanh cho thành phần hiện tại
        item.style.borderColor = 'var(--primary-color-1)';
        item.style.color = 'var(--primary-color-1)';

        // Hiển thị dropdown-content liên quan
        const dropdownContent = item.querySelector('.dropdown-content');
        dropdownContent.style.display = 'flex';

        // Lưu trạng thái của thành phần hiện tại
        selectedFilterItem = item;
    });
});

// Sự kiện click ngoài để đặt lại màu viền của tất cả các thành phần và ẩn dropdown-content
document.body.addEventListener('click', function (event) {
    const target = event.target;

    // Kiểm tra xem có phải là thành phần seacrh-result__filter-normal__content không
    const isFilterItem = target.closest('.seacrh-result__filter-normal__content');

    if (!isFilterItem) {
        filterItems.forEach(originalItem => {
            originalItem.style.borderColor = '';
            originalItem.style.color = '';
            const dropdownContent = originalItem.querySelector('.dropdown-content');
            dropdownContent.style.display = 'none';
        });

        // Reset trạng thái của thành phần đang chọn
        selectedFilterItem = null;
    }
});

const brandItems = document.querySelectorAll('.seacrh-result__filter-brand__img');

brandItems.forEach(item => {
    // Sử dụng biến để theo dõi trạng thái của mỗi thành phần
    let isItemSelected = false;

    item.addEventListener('click', () => {
        // Nếu đã chọn, hủy chọn và đặt lại màu viền
        if (isItemSelected) {
            item.style.borderColor = '';
            isItemSelected = false;
        } else {
            // Nếu chưa chọn, đặt màu viền xanh và đánh dấu là đã chọn
            item.style.borderColor = 'var(--primary-color-1)';
            isItemSelected = true;
        }
    });
});


const sortItem = document.querySelector('.seacrh-result__sort');
let sortedFilterItem = null;

sortItem.addEventListener('click', () => {
    // Ẩn dropdown-content của thành phần trước đó (nếu có)
    if (sortedFilterItem) {
        const prevDropdownContent = sortedFilterItem.querySelector('.dropdown-content--sort');
        prevDropdownContent.style.display = 'none';
    }

    // Đặt lại màu viền cho tất cả các thành phần
    filterItems.forEach(originalItem => {
        originalItem.style.borderColor = '';
        originalItem.style.color = '';
    });

    // Thiết lập màu viền xanh cho thành phần hiện tại
    sortItem.style.borderColor = 'var(--primary-color-1)';
    sortItem.style.color = 'var(--primary-color-1)';

    // Hiển thị dropdown-content liên quan
    const dropdownContent = sortItem.querySelector('.dropdown-content--sort');
    dropdownContent.style.display = 'flex';

    // Lưu trạng thái của thành phần hiện tại
    sortedFilterItem = sortItem;
});

// Sự kiện click ngoài để đặt lại màu viền của tất cả các thành phần và ẩn dropdown-content
document.body.addEventListener('click', function (event) {
    const target = event.target;
    const isSortItem = target.closest('.seacrh-result__sort');
    if (!isSortItem) {
        sortItem.style.borderColor = '';
        sortItem.style.color = '';
        const dropdownContent = sortItem.querySelector('.dropdown-content--sort');
        dropdownContent.style.display = 'none';
        sortedFilterItem = null;
    }
});
//thành phần bộ lọc
const dropdownItems = document.querySelectorAll('.filter-label');
dropdownItems.forEach((btn) => {
    btn.onclick = function () {
        btn.classList.add('active');
    };
});


//sort-phone
const sortBtns = document.querySelectorAll('.seacrh-result__sort--disable');
let currentActiveBtn = sortBtns[0]; // Mặc định chọn phần tử đầu tiên

currentActiveBtn.classList.add('active'); // Thêm class active mặc định

sortBtns.forEach((btn) => {
    btn.onclick = function () {
        // Bỏ class 'active' khỏi phần tử hiện tại
        currentActiveBtn.classList.remove('active');

        // Thêm class 'active' vào phần tử được click
        btn.classList.add('active');

        // Gán phần tử hiện tại là phần tử mới được click
        currentActiveBtn = btn;
    };
});

//popup
const modalBtn = document.getElementById('btn-filter');
const modals = document.querySelectorAll('.filter-popup');
const cancelBtn = document.getElementById('btn-filter-cancel');

// Open the modal when the button is clicked
modalBtn.onclick = function () {
    modals.forEach((modal) => {
        modal.classList.add('show');
    });
};

// Close the modal when the cancel button is clicked
cancelBtn.onclick = function () {
    modals.forEach((modal) => {
        modal.classList.remove('show');
    });
};

// Close the modal when clicking anywhere on the window
window.onclick = function (e) {
    modals.forEach((modal) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
};

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
            product_name: productName, // Thêm tên sản phẩm vào thông tin
            sended: false // Thêm trường sended mặc định là false
        };

        // Kiểm tra xem sản phẩm đã được click chưa (dựa trên product_variant_id)
        if (!clickedProducts.some(item => item.product_variant_id === productVariantId)) {
            clickedProducts.push(productInfo);
            // Save the updated list back to local storage
            localStorage.setItem('clickedProducts', JSON.stringify(clickedProducts));
            console.log('Tracked product:', productVariantId, 'in category:', categoryId);
        }
    } catch (error) {
        console.error('Error tracking product:', error);
    }
}

// Add tracking on document ready to avoid timing issues
document.addEventListener('DOMContentLoaded', function() {
    // Thay đổi từ tracking div.product-card sang tracking a.product__card-main
    document.querySelectorAll('.product-card .product__card-main, .product-item .product__card-main').forEach((productLink) => {
        productLink.addEventListener('click', function() {
            // Lấy product_variant_id từ URL của thẻ a
            const href = this.getAttribute('href');
            if (href && href.includes('/')) {
                const productVariantId = href.split('/')[2].split('?')[0];
                const categoryId = new URLSearchParams(href.split('?')[1]).get('category_id');
                // Lấy product_name từ thẻ h4 trong product__card-main
                const productNameElement = this.querySelector('h4');
                // Ưu tiên lấy từ thuộc tính title vì nó chứa tên đầy đủ của sản phẩm
                const productName = productNameElement && productNameElement.getAttribute('title') 
                    ? productNameElement.getAttribute('title') 
                    : (productNameElement ? productNameElement.textContent.trim() : 'Unknown Product');

                trackProductClick(productVariantId, categoryId, productName);
            }
        });
    });

    // Lấy danh sách sản phẩm đã click từ localStorage
    let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

    // DEBUGGING: Log tracked products to console when page loads
    console.log('===== TRACKING DEBUGGING (search results) =====');
    console.log('Products tracked in this session:', clickedProducts);
    console.log('=======================================');

    // Đã loại bỏ phần gửi dữ liệu đến server - chỉ gửi khi người dùng quay về trang chủ
});
